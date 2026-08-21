/**
 * E3 — Reconciliation for file-imported bank statements.
 *
 * Operates over `bank_statement_transactions` (E1/E2 tables). Reuses the pure
 * scorer in `open-finance/match-score.ts`. Nothing is auto-reconciled; the
 * user explicitly confirms each match.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scoreMatch, tierFor, type ConfidenceTier } from "./open-finance/match-score";

export type StatementMatchCandidate = {
  financialTransactionId: string;
  description: string;
  amount: number;
  date: string | null;
  type: "INCOME" | "EXPENSE";
  status: string;
  score: number;
  tier: ConfidenceTier;
};

export type StatementSuggestion = {
  bankTransaction: {
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
    type: "CREDIT" | "DEBIT";
    reconciliation_status: "PENDING" | "SUGGESTED" | "RECONCILED" | "IGNORED";
    bank_account_id: string | null;
  };
  candidates: StatementMatchCandidate[];
};

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa vinculada.");
  return cid;
}

const ListSchema = z
  .object({
    importId: z.string().uuid().optional(),
    bankAccountId: z.string().uuid().optional(),
    status: z.enum(["PENDING", "SUGGESTED", "RECONCILED", "IGNORED"]).optional(),
    minScore: z.number().min(0).max(100).default(50),
    limit: z.number().int().min(1).max(200).default(100),
  })
  .default({ minScore: 50, limit: 100 });

export const listStatementSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    let q = sb
      .from("bank_statement_transactions")
      .select(
        "id, transaction_date, description, amount, type, reconciliation_status, bank_account_id",
      )
      .eq("company_id", companyId)
      .order("transaction_date", { ascending: false })
      .limit(data.limit);
    if (data.importId) q = q.eq("import_id", data.importId);
    if (data.bankAccountId) q = q.eq("bank_account_id", data.bankAccountId);
    q = q.in("reconciliation_status", data.status ? [data.status] : ["PENDING", "SUGGESTED"]);

    const { data: bankTxs, error } = await q;
    if (error) throw new Error(error.message);
    if (!bankTxs?.length) return [] as StatementSuggestion[];

    const dates = bankTxs.map((b: any) => b.transaction_date);
    const minDate = dates.reduce((m: string, d: string) => (d < m ? d : m), dates[0]);
    const maxDate = dates.reduce((m: string, d: string) => (d > m ? d : m), dates[0]);
    const wStart = new Date(minDate);
    wStart.setDate(wStart.getDate() - 15);
    const wEnd = new Date(maxDate);
    wEnd.setDate(wEnd.getDate() + 15);

    const { data: finTxs } = await sb
      .from("financial_transactions")
      .select("id, description, amount, due_date, paid_at, type, status")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("status", ["PLANNED", "PAID", "OVERDUE"])
      .gte("due_date", wStart.toISOString().slice(0, 10))
      .lte("due_date", wEnd.toISOString().slice(0, 10))
      .limit(1000);

    const candidates = finTxs ?? [];
    const result: StatementSuggestion[] = [];

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
            financialTransactionId: f.id as string,
            description: f.description as string,
            amount: Number(f.amount),
            date: (f.paid_at ?? f.due_date) as string | null,
            type: f.type as "INCOME" | "EXPENSE",
            status: f.status as string,
            score: s,
            tier: tierFor(s),
          };
        })
        .filter((c: StatementMatchCandidate) => c.score >= data.minScore)
        .sort((a: StatementMatchCandidate, b: StatementMatchCandidate) => b.score - a.score)
        .slice(0, 3);

      result.push({
        bankTransaction: {
          id: b.id,
          transaction_date: b.transaction_date,
          description: b.description ?? "",
          amount: Number(b.amount),
          type: b.type,
          reconciliation_status: b.reconciliation_status,
          bank_account_id: b.bank_account_id,
        },
        candidates: scored,
      });
    }
    return result;
  });

export const confirmStatementReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bankStatementTransactionId: z.string().uuid(),
        financialTransactionId: z.string().uuid(),
        confidenceScore: z.number().min(0).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const [{ data: bank }, { data: fin }] = await Promise.all([
      sb
        .from("bank_statement_transactions")
        .select("id, transaction_date, reconciliation_status")
        .eq("id", data.bankStatementTransactionId)
        .eq("company_id", companyId)
        .maybeSingle(),
      sb
        .from("financial_transactions")
        .select("id, paid_at, status")
        .eq("id", data.financialTransactionId)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    if (!bank) throw new Error("Lançamento bancário não encontrado.");
    if (!fin) throw new Error("Lançamento financeiro não encontrado.");
    if (bank.reconciliation_status === "RECONCILED") throw new Error("Lançamento já conciliado.");

    const { error: rErr } = await sb.from("bank_reconciliations").insert({
      company_id: companyId,
      bank_transaction_id: bank.id,
      financial_transaction_id: fin.id,
      source: "STATEMENT_FILE",
      status: "CONFIRMED",
      confidence_score: data.confidenceScore ?? null,
      matched_by: "MANUAL",
      confirmed_by: context.userId,
      confirmed_at: new Date().toISOString(),
    });
    if (rErr) throw new Error(rErr.message);

    await sb
      .from("bank_statement_transactions")
      .update({
        reconciliation_status: "RECONCILED",
        reconciled_financial_transaction_id: fin.id,
      })
      .eq("id", bank.id);

    await sb
      .from("financial_transactions")
      .update({
        status: "RECONCILED",
        paid_at: fin.paid_at ?? new Date(bank.transaction_date).toISOString(),
      })
      .eq("id", fin.id);

    return { ok: true };
  });

export const ignoreStatementTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bankStatementTransactionId: z.string().uuid(),
        reason: z.string().trim().max(280).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("bank_statement_transactions")
      .update({ reconciliation_status: "IGNORED", ignored_reason: data.reason ?? null })
      .eq("id", data.bankStatementTransactionId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const undoStatementReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ bankStatementTransactionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const { data: bank } = await sb
      .from("bank_statement_transactions")
      .select("id, reconciled_financial_transaction_id")
      .eq("id", data.bankStatementTransactionId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!bank) throw new Error("Lançamento bancário não encontrado.");

    await sb
      .from("bank_reconciliations")
      .update({ status: "CANCELED" })
      .eq("bank_transaction_id", bank.id)
      .eq("company_id", companyId)
      .eq("status", "CONFIRMED");

    if (bank.reconciled_financial_transaction_id) {
      await sb
        .from("financial_transactions")
        .update({ status: "PLANNED" })
        .eq("id", bank.reconciled_financial_transaction_id)
        .eq("company_id", companyId);
    }

    await sb
      .from("bank_statement_transactions")
      .update({ reconciliation_status: "PENDING", reconciled_financial_transaction_id: null })
      .eq("id", bank.id);

    return { ok: true };
  });

export const createFinancialFromStatementTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bankStatementTransactionId: z.string().uuid(),
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
      .from("bank_statement_transactions")
      .select("*")
      .eq("id", data.bankStatementTransactionId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!b) throw new Error("Lançamento bancário não encontrado.");

    // Idempotência: se já existe lançamento vinculado a esta linha do extrato,
    // não criar duplicata — retornar o existente.
    if (b.reconciled_financial_transaction_id) {
      return {
        ok: true,
        financial_transaction_id: b.reconciled_financial_transaction_id,
        already_existed: true,
      };
    }
    if (b.reconciliation_status === "RECONCILED") {
      return { ok: true, financial_transaction_id: null, already_existed: true };
    }

    // Defesa adicional: reconciliação confirmada existente para esta linha.
    const { data: existingRec } = await sb
      .from("bank_reconciliations")
      .select("financial_transaction_id")
      .eq("company_id", companyId)
      .eq("bank_transaction_id", b.id)
      .eq("status", "CONFIRMED")
      .maybeSingle();
    if (existingRec?.financial_transaction_id) {
      await sb
        .from("bank_statement_transactions")
        .update({
          reconciliation_status: "RECONCILED",
          reconciled_financial_transaction_id: existingRec.financial_transaction_id,
        })
        .eq("id", b.id);
      return {
        ok: true,
        financial_transaction_id: existingRec.financial_transaction_id,
        already_existed: true,
      };
    }

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
        description: b.description ?? "Lançamento bancário",
        amount,
        due_date: b.transaction_date,
        paid_at: new Date(b.transaction_date).toISOString(),
        status: "RECONCILED",
        origin: "BANK_STATEMENT",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await sb.from("bank_reconciliations").insert({
      company_id: companyId,
      bank_transaction_id: b.id,
      financial_transaction_id: fin.id,
      source: "STATEMENT_FILE",
      status: "CONFIRMED",
      matched_by: "MANUAL",
      confirmed_by: context.userId,
      confirmed_at: new Date().toISOString(),
    });

    await sb
      .from("bank_statement_transactions")
      .update({
        reconciliation_status: "RECONCILED",
        reconciled_financial_transaction_id: fin.id,
      })
      .eq("id", b.id);

    return { ok: true, financial_transaction_id: fin.id };
  });
