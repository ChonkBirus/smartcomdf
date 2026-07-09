import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa vinculada.");
  return cid;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* -------------------- Quote → Receivable -------------------- */

export const getReceivableByQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ quote_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("financial_transactions")
      .select("*")
      .eq("company_id", cid)
      .eq("quote_id", data.quote_id)
      .eq("type", "INCOME")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const createReceivableFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      quote_id: z.string().uuid(),
      due_date: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);

    const { data: existing } = await context.supabase
      .from("financial_transactions")
      .select("id")
      .eq("company_id", cid)
      .eq("quote_id", data.quote_id)
      .eq("type", "INCOME")
      .is("deleted_at", null)
      .maybeSingle();
    if (existing?.id) return { id: existing.id, duplicate: true };

    const { data: quote, error: qerr } = await context.supabase
      .from("quotes")
      .select("id, company_id, customer_id, total_amount, status, valid_until, payment_status")
      .eq("id", data.quote_id)
      .eq("company_id", cid)
      .maybeSingle();
    if (qerr) throw new Error(qerr.message);
    if (!quote) throw new Error("Orçamento não encontrado.");
    const qStatus = String(quote.status);
    if (qStatus !== "APPROVED" && qStatus !== "CONVERTED") {
      throw new Error("Orçamento precisa estar aprovado.");
    }

    const due = data.due_date ?? quote.valid_until ?? addDays(new Date(), 7);
    const isPaid = quote.payment_status === "PAYMENT_APPROVED";

    const { data: inserted, error } = await context.supabase
      .from("financial_transactions")
      .insert({
        company_id: cid,
        type: "INCOME",
        description: `Recebível do orçamento`,
        amount: Number(quote.total_amount ?? 0),
        due_date: due,
        paid_at: isPaid ? new Date().toISOString() : null,
        status: isPaid ? "PAID" : "PLANNED",
        customer_id: quote.customer_id,
        quote_id: quote.id,
        origin: "QUOTE",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted!.id, duplicate: false };
  });

export const markReceivablePaidFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      quote_id: z.string().uuid(),
      paid_at: z.string().optional(),
      payment_method: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("financial_transactions")
      .select("id, status")
      .eq("company_id", cid)
      .eq("quote_id", data.quote_id)
      .eq("type", "INCOME")
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) return { ok: false, reason: "not_found" };
    if (row.status === "PAID") return { ok: true, already: true };
    const patch: any = {
      status: "PAID",
      paid_at: data.paid_at ?? new Date().toISOString(),
    };
    if (data.payment_method) patch.payment_method = data.payment_method;
    const { error } = await context.supabase
      .from("financial_transactions")
      .update(patch)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- Purchase → Payable -------------------- */

export const getPayableByPurchase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ purchase_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("financial_transactions")
      .select("*")
      .eq("company_id", cid)
      .eq("purchase_id", data.purchase_id)
      .eq("type", "EXPENSE")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listPayableStatusesByPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ purchase_ids: z.array(z.string().uuid()).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.purchase_ids.length) return {} as Record<string, { status: string; paid_at: string | null }>;
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("financial_transactions")
      .select("purchase_id,status,paid_at")
      .eq("company_id", cid)
      .eq("type", "EXPENSE")
      .is("deleted_at", null)
      .in("purchase_id", data.purchase_ids);
    if (error) throw new Error(error.message);
    const map: Record<string, { status: string; paid_at: string | null }> = {};
    for (const r of (rows ?? []) as any[]) {
      if (!r.purchase_id) continue;
      const cur = map[r.purchase_id];
      // PAID beats PLANNED; CANCELED beats nothing
      if (!cur || (cur.status !== "PAID" && r.status === "PAID")) {
        map[r.purchase_id] = { status: r.status, paid_at: r.paid_at };
      }
    }
    return map;
  });

export const createPayableFromPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      purchase_id: z.string().uuid(),
      due_date: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);

    const { data: existing } = await context.supabase
      .from("financial_transactions")
      .select("id")
      .eq("company_id", cid)
      .eq("purchase_id", data.purchase_id)
      .eq("type", "EXPENSE")
      .is("deleted_at", null)
      .maybeSingle();
    if (existing?.id) return { id: existing.id, duplicate: true };

    const { data: po, error: perr } = await context.supabase
      .from("purchase_orders")
      .select("id, company_id, supplier_id, total_amount, order_number")
      .eq("id", data.purchase_id)
      .eq("company_id", cid)
      .maybeSingle();
    if (perr) throw new Error(perr.message);
    if (!po) throw new Error("Compra não encontrada.");

    const due = data.due_date ?? addDays(new Date(), 30);

    const { data: inserted, error } = await context.supabase
      .from("financial_transactions")
      .insert({
        company_id: cid,
        type: "EXPENSE",
        description: `Compra ${po.order_number ?? ""}`.trim(),
        amount: Number(po.total_amount ?? 0),
        due_date: due,
        status: "PLANNED",
        supplier_id: po.supplier_id,
        purchase_id: po.id,
        origin: "PURCHASE",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted!.id, duplicate: false };
  });

export const markPurchaseOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      purchase_id: z.string().uuid(),
      bank_account_id: z.string().uuid(),
      paid_at: z.string().optional(),
      payment_method: z.string().trim().max(60).optional(),
      notes: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_purchase_order_paid", {
      _po_id: data.purchase_id,
      _bank_account_id: data.bank_account_id,
      _payment_method: data.payment_method || undefined,
      _paid_at: data.paid_at ?? new Date().toISOString(),
      _notes: data.notes || undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- Summaries -------------------- */

export type FinSummary = {
  totalReceivable: number;
  totalReceived: number;
  totalOverdue: number;
  totalPayable: number;
  totalPaidOut: number;
  lastReceiptAt: string | null;
  transactions: Array<{
    id: string;
    type: "INCOME" | "EXPENSE";
    description: string;
    amount: number;
    due_date: string | null;
    paid_at: string | null;
    status: string;
    origin: string;
    quote_id: string | null;
    purchase_id: string | null;
  }>;
};

function summarize(rows: any[]): FinSummary {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const s: FinSummary = {
    totalReceivable: 0, totalReceived: 0, totalOverdue: 0,
    totalPayable: 0, totalPaidOut: 0, lastReceiptAt: null,
    transactions: rows.map((r) => ({
      id: r.id, type: r.type, description: r.description,
      amount: Number(r.amount ?? 0), due_date: r.due_date, paid_at: r.paid_at,
      status: r.status, origin: r.origin,
      quote_id: r.quote_id, purchase_id: r.purchase_id,
    })),
  };
  for (const r of rows) {
    const amt = Number(r.amount ?? 0);
    const isOverdue = r.status === "PLANNED" && r.due_date && new Date(r.due_date) < today;
    if (r.type === "INCOME") {
      if (r.status === "PAID") {
        s.totalReceived += amt;
        if (r.paid_at && (!s.lastReceiptAt || r.paid_at > s.lastReceiptAt)) s.lastReceiptAt = r.paid_at;
      } else if (r.status === "PLANNED") {
        s.totalReceivable += amt;
        if (isOverdue) s.totalOverdue += amt;
      }
    } else if (r.type === "EXPENSE") {
      if (r.status === "PAID") s.totalPaidOut += amt;
      else if (r.status === "PLANNED") s.totalPayable += amt;
    }
  }
  return s;
}

export const getCustomerFinancialSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FinSummary> => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("financial_transactions")
      .select("id,type,description,amount,due_date,paid_at,status,origin,quote_id,purchase_id")
      .eq("company_id", cid)
      .eq("customer_id", data.customer_id)
      .is("deleted_at", null)
      .order("due_date", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return summarize(rows ?? []);
  });

export const getProjectFinancialSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FinSummary> => {
    const cid = await getCompanyId(context.supabase, context.userId);
    // Project may link directly OR indirectly via quote_id
    const { data: project } = await context.supabase
      .from("projects")
      .select("id, quote_id, customer_id")
      .eq("id", data.project_id)
      .eq("company_id", cid)
      .maybeSingle();
    let q = context.supabase
      .from("financial_transactions")
      .select("id,type,description,amount,due_date,paid_at,status,origin,quote_id,purchase_id")
      .eq("company_id", cid)
      .is("deleted_at", null);
    if (project?.quote_id) {
      q = q.or(`project_id.eq.${data.project_id},quote_id.eq.${project.quote_id}`);
    } else {
      q = q.eq("project_id", data.project_id);
    }
    const { data: rows, error } = await q.order("due_date", { ascending: false, nullsFirst: false }).limit(100);
    if (error) throw new Error(error.message);
    return summarize(rows ?? []);
  });

export const getServiceOrderFinancialSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ service_order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FinSummary> => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: so } = await context.supabase
      .from("service_orders")
      .select("id, project_id")
      .eq("id", data.service_order_id)
      .eq("company_id", cid)
      .maybeSingle();
    let projectQuoteId: string | null = null;
    if (so?.project_id) {
      const { data: p } = await context.supabase
        .from("projects").select("quote_id").eq("id", so.project_id).maybeSingle();
      projectQuoteId = (p?.quote_id as string | null) ?? null;
    }
    let q = context.supabase
      .from("financial_transactions")
      .select("id,type,description,amount,due_date,paid_at,status,origin,quote_id,purchase_id")
      .eq("company_id", cid)
      .is("deleted_at", null);
    const ors: string[] = [`service_order_id.eq.${data.service_order_id}`];
    if (so?.project_id) ors.push(`project_id.eq.${so.project_id}`);
    if (projectQuoteId) ors.push(`quote_id.eq.${projectQuoteId}`);
    q = q.or(ors.join(","));
    const { data: rows, error } = await q.order("due_date", { ascending: false, nullsFirst: false }).limit(100);
    if (error) throw new Error(error.message);
    return summarize(rows ?? []);
  });
