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

    // Guard: any ACTIVE INCOME transaction for this quote (canonical OR legacy)
    // blocks creation. CANCELED rows never block — o recebível pode ser reemitido.
    const { data: anyExisting } = await context.supabase
      .from("financial_transactions")
      .select("id, origin_type, status")
      .eq("company_id", cid)
      .eq("quote_id", data.quote_id)
      .eq("type", "INCOME")
      .is("deleted_at", null)
      .neq("status", "CANCELED")
      .limit(5);
    if (anyExisting && anyExisting.length > 0) {
      const legacy = anyExisting.find((r: any) => r.origin_type == null);
      if (legacy) {
        return { id: (legacy as any).id, duplicate: true, legacy: true };
      }
      return { id: (anyExisting[0] as any).id, duplicate: true };
    }

    const { data: quote, error: qerr } = await context.supabase
      .from("quotes")
      .select("id, company_id, customer_id, total_amount, status, valid_until, payment_status, project_id")
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

    // Canonical row: single QUOTE_RECEIVABLE_BALANCE with full total, PLANNED.
    // origin_type/origin_id fill the (company_id, origin_type, origin_id)
    // unique index for idempotency across retries.
    const { data: inserted, error } = await context.supabase
      .from("financial_transactions")
      .insert({
        company_id: cid,
        type: "INCOME",
        description: `Recebível do orçamento`,
        amount: Number(quote.total_amount ?? 0),
        due_date: due,
        status: "PLANNED",
        customer_id: quote.customer_id,
        quote_id: quote.id,
        project_id: (quote as any).project_id ?? null,
        origin: "QUOTE",
        origin_type: "QUOTE_RECEIVABLE_BALANCE",
        origin_id: quote.id,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      // Idempotência: violação do índice único → tratar como duplicate.
      const msg = error.message || "";
      if (/duplicate key|financial_transactions_origin_uniq/i.test(msg)) {
        const { data: again } = await context.supabase
          .from("financial_transactions")
          .select("id")
          .eq("company_id", cid)
          .eq("origin_type", "QUOTE_RECEIVABLE_BALANCE")
          .eq("origin_id", quote.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (again?.id) return { id: again.id, duplicate: true };
      }
      throw new Error(msg);
    }
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

    // Se já existe QUOTE_PAYMENT canônico PAID, o fluxo canônico já correu.
    const { data: canonicalPaid } = await context.supabase
      .from("financial_transactions")
      .select("id")
      .eq("company_id", cid)
      .eq("quote_id", data.quote_id)
      .eq("origin_type", "QUOTE_PAYMENT")
      .eq("status", "PAID")
      .is("deleted_at", null)
      .limit(1);
    if (canonicalPaid && canonicalPaid.length > 0) {
      return { ok: true, already: true };
    }

    // Fluxo legado desativado: mutar uma linha origin_type NULL "à mão"
    // era o que criava divergência com approve_quote_payment. Bloqueado no server.
    throw new Error(
      "Fluxo legado desativado. Registre um pagamento em quote_payments e aprove via approve_quote_payment.",
    );
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

/* -------------------- Project Margin (PR6C) -------------------- */

export type ProjectMarginSummary = {
  hasQuote: boolean;
  revenue: {
    total: number;
    received: number;
    remaining: number;
    financial_status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | null;
  };
  cost: {
    estimated: number | null;
    estimatedHasData: boolean;
    realized: number;
    realizedMaterials: number;
    realizedExtras: number;
    realizedEmployees: number;
  };
  profit: {
    estimated: number | null;
    realized: number | null;
  };
  margin: {
    estimatedPct: number | null;
    realizedPct: number | null;
  };
  estimatedBreakdown: Array<{
    id: string;
    name: string;
    quantity: number;
    unit_cost: number;
    total_cost: number;
    has_cost: boolean;
  }>;
  realizedBreakdown: Array<{
    id: string;
    kind: "MATERIAL" | "EXPENSE" | "EMPLOYEE";
    description: string;
    service_order_id: string | null;
    service_order_number: string | null;
    amount: number;
    date: string | null;
  }>;
  serviceOrders: Array<{
    id: string;
    service_order_number: string;
    status: string;
    technician_name: string | null;
    estimatedCost: number;
    realizedCost: number;
    extrasCost: number;
    employeesCost: number;
  }>;
};


export const getProjectMarginSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ProjectMarginSummary> => {
    const sb = context.supabase as any;
    const cid = await getCompanyId(sb, context.userId);

    const { data: project } = await sb
      .from("projects")
      .select("id, quote_id")
      .eq("id", data.project_id)
      .eq("company_id", cid)
      .maybeSingle();
    if (!project) throw new Error("Projeto não encontrado.");

    // Revenue from quote
    let revenue = { total: 0, received: 0, remaining: 0, financial_status: null as any };
    let estimatedBreakdown: ProjectMarginSummary["estimatedBreakdown"] = [];
    let estimated = 0;
    let estimatedHasData = false;

    if (project.quote_id) {
      const { data: q } = await sb
        .from("quotes")
        .select("total_amount,paid_amount,remaining_amount,financial_status")
        .eq("id", project.quote_id)
        .eq("company_id", cid)
        .maybeSingle();
      if (q) {
        const total = Number(q.total_amount || 0);
        let paid = Number(q.paid_amount || 0);
        if (!paid) {
          const { data: tx } = await sb
            .from("financial_transactions")
            .select("amount")
            .eq("company_id", cid)
            .eq("quote_id", project.quote_id)
            .eq("origin_type", "QUOTE_PAYMENT")
            .eq("status", "PAID")
            .is("deleted_at", null);
          paid = (tx ?? []).reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
        }
        const remaining = q.remaining_amount != null ? Number(q.remaining_amount) : Math.max(0, total - paid);
        revenue = {
          total,
          received: paid,
          remaining,
          financial_status: (q.financial_status as any) ?? (paid <= 0 ? "UNPAID" : paid >= total ? "PAID" : "PARTIALLY_PAID"),
        };
      }

      const { data: qItems } = await sb
        .from("quote_items")
        .select("id,name,quantity,cost_price")
        .eq("company_id", cid)
        .eq("quote_id", project.quote_id);
      for (const it of (qItems ?? []) as any[]) {
        const qty = Number(it.quantity || 0);
        const cp = Number(it.cost_price || 0);
        const line = qty * cp;
        if (cp > 0) { estimatedHasData = true; estimated += line; }
        estimatedBreakdown.push({
          id: it.id, name: it.name, quantity: qty,
          unit_cost: cp, total_cost: line, has_cost: cp > 0,
        });
      }
    }

    // Service orders in project
    const { data: sos } = await sb
      .from("service_orders")
      .select("id, service_order_number, status, technician_name")
      .eq("company_id", cid)
      .eq("project_id", data.project_id)
      .is("deleted_at", null);
    const soList = (sos ?? []) as any[];
    const soIds = soList.map((s) => s.id);
    const soMap: Record<string, any> = {};
    soList.forEach((s) => { soMap[s.id] = { ...s, estimatedCost: 0, realizedCost: 0, extrasCost: 0, employeesCost: 0 }; });

    // Materials realized: service_order_material_usage x items.cost_price
    let realizedMaterials = 0;
    const realizedBreakdown: ProjectMarginSummary["realizedBreakdown"] = [];
    if (soIds.length) {
      const { data: usage } = await sb
        .from("service_order_material_usage")
        .select("id,service_order_id,item_id,planned_quantity,used_quantity,created_at")
        .in("service_order_id", soIds);
      const itemIds = Array.from(new Set((usage ?? []).map((u: any) => u.item_id).filter(Boolean)));
      const costMap: Record<string, { cost: number; name: string }> = {};
      if (itemIds.length) {
        const { data: items } = await sb
          .from("items")
          .select("id,name,cost_price")
          .eq("company_id", cid)
          .in("id", itemIds);
        (items ?? []).forEach((i: any) => {
          costMap[i.id] = { cost: Number(i.cost_price || 0), name: i.name };
        });
      }
      for (const u of (usage ?? []) as any[]) {
        const info = costMap[u.item_id];
        const cost = info?.cost ?? 0;
        const usedQty = Number(u.used_quantity || 0);
        const plannedQty = Number(u.planned_quantity || 0);
        const usedTotal = usedQty * cost;
        const plannedTotal = plannedQty * cost;
        if (usedTotal > 0) {
          realizedMaterials += usedTotal;
          realizedBreakdown.push({
            id: u.id, kind: "MATERIAL",
            description: info?.name ?? "Material",
            service_order_id: u.service_order_id,
            service_order_number: soMap[u.service_order_id]?.service_order_number ?? null,
            amount: usedTotal, date: u.created_at,
          });
        }
        const so = soMap[u.service_order_id];
        if (so) {
          so.realizedCost += usedTotal;
          so.estimatedCost += plannedTotal;
        }
      }
    }

    // Extra costs: PAID financial_transactions with SERVICE_ORDER_COST origin_type (or direct project link)
    let realizedExtras = 0;
    const ors: string[] = [`project_id.eq.${data.project_id}`];
    if (soIds.length) ors.push(`service_order_id.in.(${soIds.join(",")})`);
    const { data: exp } = await sb
      .from("financial_transactions")
      .select("id,description,amount,paid_at,service_order_id,origin_type,status,type")
      .eq("company_id", cid)
      .eq("type", "EXPENSE")
      .eq("status", "PAID")
      .eq("origin_type", "SERVICE_ORDER_COST")
      .is("deleted_at", null)
      .or(ors.join(","));
    for (const e of (exp ?? []) as any[]) {
      const amt = Number(e.amount || 0);
      realizedExtras += amt;
      realizedBreakdown.push({
        id: e.id, kind: "EXPENSE",
        description: e.description || "Custo avulso",
        service_order_id: e.service_order_id,
        service_order_number: e.service_order_id ? (soMap[e.service_order_id]?.service_order_number ?? null) : null,
        amount: amt, date: e.paid_at,
      });
      if (e.service_order_id && soMap[e.service_order_id]) {
        soMap[e.service_order_id].extrasCost += amt;
        soMap[e.service_order_id].realizedCost += amt;
      }
    }

    // Employee/team labor costs (project_employee_costs).
    // RLS on this table restricts SELECT to owners/managers/financial/employees.manage
    // via can_view_employee_costs(); for users without permission the query returns
    // an empty set, so realizedEmployees = 0 and no monetary value leaks.
    // NOTE: does NOT create financial_transactions — costs count only for margin.
    let realizedEmployees = 0;
    const { data: emps } = await sb
      .from("project_employee_costs")
      .select(
        `id, service_order_id, role_snapshot,
         daily_rate_snapshot, days_count,
         transport_cost, meal_cost, other_cost, created_at,
         employee:employee_id(name)`,
      )
      .eq("company_id", cid)
      .eq("project_id", data.project_id)
      .is("deleted_at", null);
    for (const e of (emps ?? []) as any[]) {
      const rate = Number(e.daily_rate_snapshot || 0);
      const days = Number(e.days_count || 0);
      const transport = Number(e.transport_cost || 0);
      const meal = Number(e.meal_cost || 0);
      const other = Number(e.other_cost || 0);
      const amt = rate * days + transport + meal + other;
      if (amt <= 0) continue;
      realizedEmployees += amt;
      const empName = e.employee?.name ?? "Funcionário";
      const roleLabel = e.role_snapshot ? ` (${e.role_snapshot})` : "";
      realizedBreakdown.push({
        id: e.id, kind: "EMPLOYEE",
        description: `${empName}${roleLabel} — ${days} diária(s)`,
        service_order_id: e.service_order_id,
        service_order_number: e.service_order_id ? (soMap[e.service_order_id]?.service_order_number ?? null) : null,
        amount: amt, date: e.created_at,
      });
      if (e.service_order_id && soMap[e.service_order_id]) {
        soMap[e.service_order_id].employeesCost += amt;
        soMap[e.service_order_id].realizedCost += amt;
      }
    }

    const realized = realizedMaterials + realizedExtras + realizedEmployees;
    const estimatedCost = estimatedHasData ? estimated : null;
    const profitEstimated = estimatedCost != null && revenue.total > 0 ? revenue.total - estimatedCost : null;
    const profitRealized = revenue.received > 0 ? revenue.received - realized : null;
    const marginEstimatedPct = profitEstimated != null && revenue.total > 0 ? (profitEstimated / revenue.total) * 100 : null;
    const marginRealizedPct = profitRealized != null && revenue.received > 0 ? (profitRealized / revenue.received) * 100 : null;

    return {
      hasQuote: !!project.quote_id,
      revenue,
      cost: {
        estimated: estimatedCost, estimatedHasData,
        realized, realizedMaterials, realizedExtras, realizedEmployees,
      },
      profit: { estimated: profitEstimated, realized: profitRealized },
      margin: { estimatedPct: marginEstimatedPct, realizedPct: marginRealizedPct },
      estimatedBreakdown,
      realizedBreakdown: realizedBreakdown.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      serviceOrders: Object.values(soMap).map((s: any) => ({
        id: s.id,
        service_order_number: s.service_order_number,
        status: s.status,
        technician_name: s.technician_name ?? null,
        estimatedCost: s.estimatedCost,
        realizedCost: s.realizedCost,
        extrasCost: s.extrasCost,
        employeesCost: s.employeesCost,
      })),
    };
  });

