import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Best-effort: mirror payment into linked financial receivable.
    // If a receivable exists → mark PAID. If not → create one already PAID.
    // The unique index (company_id, quote_id, type=INCOME) prevents duplicates.
    try {
      const { data: pay } = await sb
        .from("quote_payments")
        .select("quote_id, payment_method, company_id, amount")
        .eq("id", data.id)
        .maybeSingle();
      if (pay?.quote_id) {
        const nowIso = new Date().toISOString();
        const { data: row } = await sb
          .from("financial_transactions")
          .select("id, status")
          .eq("company_id", pay.company_id)
          .eq("quote_id", pay.quote_id)
          .eq("type", "INCOME")
          .is("deleted_at", null)
          .maybeSingle();
        if (row) {
          if (row.status !== "PAID") {
            await sb.from("financial_transactions").update({
              status: "PAID",
              paid_at: nowIso,
              payment_method: pay.payment_method ?? null,
            }).eq("id", row.id);
          }
        } else {
          // Create receivable already paid, based on the quote total.
          const { data: quote } = await sb
            .from("quotes")
            .select("customer_id, total_amount, valid_until")
            .eq("id", pay.quote_id)
            .eq("company_id", pay.company_id)
            .maybeSingle();
          if (quote) {
            const due = quote.valid_until ?? nowIso.slice(0, 10);
            await sb.from("financial_transactions").insert({
              company_id: pay.company_id,
              type: "INCOME",
              description: "Recebível do orçamento (pagamento aprovado)",
              amount: Number(quote.total_amount ?? pay.amount ?? 0),
              due_date: due,
              paid_at: nowIso,
              status: "PAID",
              customer_id: quote.customer_id,
              quote_id: pay.quote_id,
              payment_method: pay.payment_method ?? null,
              origin: "QUOTE",
              created_by: context.userId,
            });
          }
        }
      }
    } catch { /* non-blocking */ }


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
