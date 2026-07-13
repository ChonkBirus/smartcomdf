import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// PR2 — Comprovantes de pagamento
// ============================================================

export const rejectQuotePaymentReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      reason: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("reject_quote_payment_receipt", {
      _payment_id: data.id,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Gera URL assinada (5 min) para o comprovante de um quote_payment.
 * Autorização: precisa pertencer à empresa do pagamento + permissão financeira.
 * Usa supabaseAdmin (bucket privado); a checagem de autorização é feita
 * antes do signing via `context.supabase` (RLS como o usuário).
 */
export const getQuoteReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    // RLS garante que só enxergamos linhas da mesma empresa
    const { data: row, error } = await sb
      .from("quote_payments")
      .select("id, company_id, receipt_file_path, receipt_mime_type")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.receipt_file_path) throw new Error("Comprovante não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("payment-receipts")
      .createSignedUrl(row.receipt_file_path, 300); // 5 min
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl, mime: row.receipt_mime_type as string | null };
  });

export type QuotePayment = {
  id: string;
  company_id: string;
  quote_id: string;
  payment_type: "DOWN_PAYMENT" | "REMAINING_PAYMENT" | "FULL_PAYMENT";
  payment_method: "PIX" | "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
  payment_status: "PENDING" | "WAITING_PAYMENT" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  amount: number;
  description: string | null;
  pix_key: string | null;
  pix_copy_paste: string | null;
  pix_qr_code_url: string | null;
  paid_at: string | null;
  approved_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export const listQuotePayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ quote_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa vinculada.");
    const { data: rows, error } = await sb
      .from("quote_payments")
      .select("*")
      .eq("quote_id", data.quote_id)
      .eq("company_id", prof.company_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      amount: Number(r.amount || 0),
    })) as QuotePayment[];
  });

/**
 * Espelha um `quote_payments` aprovado para `financial_transactions`.
 * - Se existe recebível `(company_id, quote_id, type=INCOME)` não pago → marca PAID.
 * - Se não existe → cria já com status PAID.
 * Idempotente: chamadas repetidas nunca duplicam (garantido também por índice único).
 * Exportada para permitir teste de regressão.
 */
export async function mirrorQuotePaymentToFinancial(
  sb: any,
  { paymentId, userId }: { paymentId: string; userId: string },
): Promise<{ action: "noop" | "updated" | "created" }> {
  const { data: pay } = await sb
    .from("quote_payments")
    .select("quote_id, payment_method, company_id, amount")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay?.quote_id) return { action: "noop" };

  const nowIso = new Date().toISOString();

  // Idempotência #1: já existe transação para este quote_payment_id?
  const { data: byPayment } = await sb
    .from("financial_transactions")
    .select("id, status")
    .eq("company_id", pay.company_id)
    .eq("quote_payment_id", paymentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (byPayment) {
    if (byPayment.status === "PAID") return { action: "noop" };
    await sb.from("financial_transactions").update({
      status: "PAID",
      paid_at: nowIso,
      payment_method: pay.payment_method ?? null,
    }).eq("id", byPayment.id);
    return { action: "updated" };
  }

  // Compatibilidade: recebível legado por quote (sem quote_payment_id)
  const { data: row } = await sb
    .from("financial_transactions")
    .select("id, status")
    .eq("company_id", pay.company_id)
    .eq("quote_id", pay.quote_id)
    .eq("type", "INCOME")
    .is("quote_payment_id", null)
    .is("deleted_at", null)
    .maybeSingle();

  if (row) {
    if (row.status === "PAID") return { action: "noop" };
    await sb.from("financial_transactions").update({
      status: "PAID",
      paid_at: nowIso,
      payment_method: pay.payment_method ?? null,
      quote_payment_id: paymentId,
      origin_type: "QUOTE_PAYMENT",
      origin_id: paymentId,
    }).eq("id", row.id);
    return { action: "updated" };
  }

  const { data: quote } = await sb
    .from("quotes")
    .select("customer_id, total_amount, valid_until")
    .eq("id", pay.quote_id)
    .eq("company_id", pay.company_id)
    .maybeSingle();
  if (!quote) return { action: "noop" };

  const due = quote.valid_until ?? nowIso.slice(0, 10);
  const { error: insErr } = await sb.from("financial_transactions").insert({
    company_id: pay.company_id,
    type: "INCOME",
    description: "Recebível do orçamento (pagamento aprovado)",
    amount: Number(quote.total_amount ?? pay.amount ?? 0),
    due_date: due,
    paid_at: nowIso,
    status: "PAID",
    customer_id: quote.customer_id,
    quote_id: pay.quote_id,
    quote_payment_id: paymentId,
    payment_method: pay.payment_method ?? null,
    origin: "QUOTE",
    origin_type: "QUOTE_PAYMENT",
    origin_id: paymentId,
    created_by: userId,
  });
  if (insErr) {
    // 23505 = unique_violation → outra chamada concorrente já inseriu; noop idempotente
    const code = (insErr as any)?.code ?? "";
    const msg = String((insErr as any)?.message ?? "");
    if (code === "23505" || /duplicate key|unique/i.test(msg)) {
      return { action: "noop" };
    }
    throw insErr;
  }
  return { action: "created" };
}

export const approveQuotePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      note: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("approve_quote_payment", {
      _payment_id: data.id,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    // O RPC agora espelha atomicamente para financial_transactions
    // (SECURITY DEFINER + índice único parcial garantem idempotência).
    return { ok: true };
  });

export const resyncQuotePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("resync_quote_payment", { _payment_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelQuotePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      reason: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("cancel_quote_payment", {
      _payment_id: data.id,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Company Pix settings
// ============================================================
export type CompanyPixSettings = {
  pix_key: string | null;
  pix_key_type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" | null;
  pix_receiver_name: string | null;
  pix_receiver_city: string | null;
};

export const getCompanyPix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb
      .from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const { data, error } = await sb
      .from("company_settings")
      .select("pix_key, pix_key_type, pix_receiver_name, pix_receiver_city")
      .eq("company_id", prof.company_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? {
      pix_key: null, pix_key_type: null,
      pix_receiver_name: null, pix_receiver_city: null,
    }) as CompanyPixSettings;
  });

export const saveCompanyPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      pix_key: z.string().trim().max(200).optional().or(z.literal("")),
      pix_key_type: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]).optional().nullable(),
      pix_receiver_name: z.string().trim().max(140).optional().or(z.literal("")),
      pix_receiver_city: z.string().trim().max(80).optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb
      .from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const payload = {
      pix_key: data.pix_key || null,
      pix_key_type: data.pix_key_type || null,
      pix_receiver_name: data.pix_receiver_name || null,
      pix_receiver_city: data.pix_receiver_city || null,
    };
    const { error } = await sb
      .from("company_settings")
      .update(payload)
      .eq("company_id", prof.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
