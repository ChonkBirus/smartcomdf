/**
 * Bank reconciliation — server functions.
 *
 * - Suggestion uses `match-score.ts` (pure scorer). Tested in isolation.
 * - Confirmation requires explicit user action; nothing is auto-reconciled.
 * - All operations are company-scoped via RLS + explicit company_id checks.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scoreMatch, tierFor, type ConfidenceTier } from "./open-finance/match-score";

export type ReconciliationSuggestion = {
  bankTransaction: {
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
    type: "CREDIT" | "DEBIT";
    reconciliation_status: string;
    bank_account_id: string | null;
  };
  candidates: Array<{
    financialTransactionId: string;
    description: string;
    amount: number;
    date: string | null;
    type: "INCOME" | "EXPENSE";
    status: string;
    score: number;
    tier: ConfidenceTier;
  }>;
};

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa vinculada.");
  return cid;
}

const ListSchema = z
  .object({
    bankAccountId: z.string().uuid().optional(),
    minScore: z.number().min(0).max(100).default(50),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .default({ minScore: 50, limit: 50 });

/** List PENDING bank transactions with their top financial-transaction matches. */
export const listReconciliationSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    let q = sb
      .from("openfinance_transactions")
      .select(
        "id, transaction_date, description, amount, type, reconciliation_status, bank_account_id, customer_hint:provider_transaction_id",
      )
      .eq("company_id", companyId)
      .in("reconciliation_status", ["PENDING", "SUGGESTED"])
      .order("transaction_date", { ascending: false })
      .limit(data.limit);
    if (data.bankAccountId) q = q.eq("bank_account_id", data.bankAccountId);
    const { data: bankTxs, error } = await q;
    if (error) throw new Error(error.message);
    if (!bankTxs?.length) return [] as ReconciliationSuggestion[];

    // Pull a window of candidate financial transactions (PLANNED/PAID/OVERDUE),
    // dated within ±15 days of the earliest bank tx date for coarse pre-filter.
    const minDate = bankTxs.reduce(
      (m: string, t: any) => (t.transaction_date < m ? t.transaction_date : m),
      bankTxs[0].transaction_date,
    );
    const maxDate = bankTxs.reduce(
      (m: string, t: any) => (t.transaction_date > m ? t.transaction_date : m),
      bankTxs[0].transaction_date,
    );
    const wStart = new Date(minDate);
    wStart.setDate(wStart.getDate() - 15);
    const wEnd = new Date(maxDate);
    wEnd.setDate(wEnd.getDate() + 15);

    const { data: finTxs } = await sb
      .from("financial_transactions")
      .select("id, description, amount, due_date, paid_at, type, status, customer_id, supplier_id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("status", ["PLANNED", "PAID", "OVERDUE"])
      .gte("due_date", wStart.toISOString().slice(0, 10))
      .lte("due_date", wEnd.toISOString().slice(0, 10))
      .limit(500);

    const candidates = finTxs ?? [];
    const suggestions: ReconciliationSuggestion[] = [];

    for (const b of bankTxs) {
      const scored = candidates
        .map((f: any) => {
          const s = scoreMatch({
            bankAmount: Number(b.amount),
            bankDate: b.transaction_date,
            bankDescription: b.description ?? "",
            bankType: b.type,
            finAmount: Number(f.amount),
            finDate: f.paid_at ?? f.due_date,
            finDescription: f.description ?? "",
            finType: f.type,
            finStatus: f.status,
          });
          return {
            financialTransactionId: f.id,
            description: f.description,
            amount: Number(f.amount),
            date: f.paid_at ?? f.due_date,
            type: f.type,
            status: f.status,
            score: s,
            tier: tierFor(s),
          };
        })
        .filter((c: { score: number }) => c.score >= data.minScore)
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, 3);

      suggestions.push({
        bankTransaction: {
          id: b.id,
          transaction_date: b.transaction_date,
          description: b.description,
          amount: Number(b.amount),
          type: b.type,
          reconciliation_status: b.reconciliation_status,
          bank_account_id: b.bank_account_id,
        },
        candidates: scored,
      });
    }

    return suggestions;
  });

export const suggestBankReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bankTransactionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: b } = await sb
      .from("openfinance_transactions")
      .select("*")
      .eq("id", data.bankTransactionId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!b) throw new Error("Transação bancária não encontrada.");

    const wStart = new Date(b.transaction_date);
    wStart.setDate(wStart.getDate() - 15);
    const wEnd = new Date(b.transaction_date);
    wEnd.setDate(wEnd.getDate() + 15);
    const { data: finTxs } = await sb
      .from("financial_transactions")
      .select("id, description, amount, due_date, paid_at, type, status")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("status", ["PLANNED", "PAID", "OVERDUE"])
      .gte("due_date", wStart.toISOString().slice(0, 10))
      .lte("due_date", wEnd.toISOString().slice(0, 10))
      .limit(300);

    const ranked = (finTxs ?? [])
      .map((f: any) => ({
        f,
        score: scoreMatch({
          bankAmount: Number(b.amount),
          bankDate: b.transaction_date,
          bankDescription: b.description ?? "",
          bankType: b.type,
          finAmount: Number(f.amount),
          finDate: f.paid_at ?? f.due_date,
          finDescription: f.description ?? "",
          finType: f.type,
          finStatus: f.status,
        }),
      }))
      .filter((x: any) => x.score >= 50)
      .sort((a: any, b: any) => b.score - a.score);

    return ranked.slice(0, 5).map((x: any) => ({
      financialTransactionId: x.f.id,
      description: x.f.description,
      amount: Number(x.f.amount),
      date: x.f.paid_at ?? x.f.due_date,
      type: x.f.type,
      status: x.f.status,
      score: x.score,
      tier: tierFor(x.score),
    }));
  });

export const confirmReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bankTransactionId: z.string().uuid(),
        financialTransactionId: z.string().uuid(),
        confidenceScore: z.number().min(0).max(100).optional(),
        matchedBy: z.enum(["SYSTEM", "MANUAL"]).default("MANUAL"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const [{ data: bank }, { data: fin }] = await Promise.all([
      sb
        .from("openfinance_transactions")
        .select("*")
        .eq("id", data.bankTransactionId)
        .eq("company_id", companyId)
        .maybeSingle(),
      sb
        .from("financial_transactions")
        .select("id, type, status, paid_at")
        .eq("id", data.financialTransactionId)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    if (!bank) throw new Error("Transação bancária não encontrada.");
    if (!fin) throw new Error("Lançamento financeiro não encontrado.");
    if (bank.reconciliation_status === "RECONCILED") throw new Error("Transação já conciliada.");

    const { error: bErr } = await sb.from("bank_reconciliations").insert({
      company_id: companyId,
      bank_transaction_id: bank.id,
      financial_transaction_id: fin.id,
      status: "CONFIRMED",
      confidence_score: data.confidenceScore ?? null,
      matched_by: data.matchedBy,
      confirmed_by: context.userId,
      confirmed_at: new Date().toISOString(),
    });
    if (bErr) throw new Error(bErr.message);

    await sb
      .from("openfinance_transactions")
      .update({ reconciliation_status: "RECONCILED", reconciled_transaction_id: fin.id })
      .eq("id", bank.id);

    await sb
      .from("financial_transactions")
      .update({
        status: "RECONCILED",
        paid_at: fin.paid_at ?? bank.transaction_date,
        openfinance_transaction_id: bank.id,
      })
      .eq("id", fin.id);

    return { ok: true };
  });

export const ignoreBankTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bankTransactionId: z.string().uuid(),
        reason: z.string().trim().max(280).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("openfinance_transactions")
      .update({ reconciliation_status: "IGNORED", ignore_reason: data.reason ?? null })
      .eq("id", data.bankTransactionId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createFinancialTransactionFromBankTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bankTransactionId: z.string().uuid(),
        categoryId: z.string().uuid().nullable().optional(),
        customerId: z.string().uuid().nullable().optional(),
        supplierId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: b } = await sb
      .from("openfinance_transactions")
      .select("*")
      .eq("id", data.bankTransactionId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!b) throw new Error("Transação bancária não encontrada.");
    if (b.reconciliation_status === "RECONCILED") throw new Error("Transação já conciliada.");

    const type = b.type === "CREDIT" ? "INCOME" : "EXPENSE";
    const amount = Math.abs(Number(b.amount));

    const { data: fin, error } = await sb
      .from("financial_transactions")
      .insert({
        company_id: companyId,
        type,
        category_id: data.categoryId ?? null,
        customer_id: data.customerId ?? null,
        supplier_id: data.supplierId ?? null,
        description: b.description,
        amount,
        due_date: b.transaction_date,
        paid_at: new Date(b.transaction_date).toISOString(),
        status: "RECONCILED",
        origin: "OPEN_FINANCE",
        openfinance_transaction_id: b.id,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await sb.from("bank_reconciliations").insert({
      company_id: companyId,
      bank_transaction_id: b.id,
      financial_transaction_id: fin.id,
      status: "CONFIRMED",
      matched_by: "MANUAL",
      confirmed_by: context.userId,
      confirmed_at: new Date().toISOString(),
    });

    await sb
      .from("openfinance_transactions")
      .update({ reconciliation_status: "RECONCILED", reconciled_transaction_id: fin.id })
      .eq("id", b.id);

    return { ok: true, financialTransactionId: fin.id };
  });

export const undoReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reconciliationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: rec } = await sb
      .from("bank_reconciliations")
      .select("*")
      .eq("id", data.reconciliationId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!rec) throw new Error("Conciliação não encontrada.");

    await sb.from("bank_reconciliations").update({ status: "CANCELED" }).eq("id", rec.id);

    if (rec.bank_transaction_id) {
      await sb
        .from("openfinance_transactions")
        .update({ reconciliation_status: "PENDING", reconciled_transaction_id: null })
        .eq("id", rec.bank_transaction_id);
    }
    if (rec.financial_transaction_id) {
      await sb
        .from("financial_transactions")
        .update({ status: "PLANNED", openfinance_transaction_id: null })
        .eq("id", rec.financial_transaction_id);
    }
    return { ok: true };
  });
