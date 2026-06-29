import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PurchaseOrderStatus =
  | "DRAFT" | "PENDING" | "APPROVED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string;
  supplier_name?: string;
  order_number: string;
  status: PurchaseOrderStatus;
  issue_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string | null;
  item_unit?: string;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  total_cost: number;
};

const itemLineSchema = z.object({
  id: z.string().uuid().optional(),
  item_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_cost: z.number().min(0),
});

const orderSchema = z.object({
  id: z.string().uuid().optional(),
  supplier_id: z.string().uuid(),
  order_number: z.string().trim().min(1).max(50).optional().or(z.literal("")),
  issue_date: z.string().min(1),
  expected_delivery_date: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z.array(itemLineSchema).min(1, "Adicione pelo menos um item."),
});

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa vinculada.");
  return data.company_id as string;
}


// ============================================================
// LIST
// ============================================================
export const listPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    status: z.string().optional(),
    supplier_id: z.string().uuid().optional(),
    search: z.string().optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb.from("purchase_orders")
      .select("*, suppliers:supplier_id(corporate_name, trade_name)")
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.supplier_id) q = q.eq("supplier_id", data.supplier_id);
    if (data.search?.trim()) q = q.ilike("order_number", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      total_amount: Number(r.total_amount || 0),
      supplier_name: r.suppliers?.trade_name || r.suppliers?.corporate_name || "—",
    })) as PurchaseOrder[];
  });

// ============================================================
// GET single + items
// ============================================================
export const getPurchaseOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: po, error: e1 } = await sb
      .from("purchase_orders")
      .select("*, suppliers:supplier_id(corporate_name, trade_name)")
      .eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!po) return null;

    const { data: items, error: e2 } = await sb
      .from("purchase_order_items")
      .select("*, items:item_id(name, sku, unit)")
      .eq("purchase_order_id", data.id)
      .order("created_at");
    if (e2) throw new Error(e2.message);

    return {
      order: {
        ...po,
        total_amount: Number(po.total_amount || 0),
        supplier_name: po.suppliers?.trade_name || po.suppliers?.corporate_name || "—",
      } as PurchaseOrder,
      items: (items ?? []).map((it: any) => ({
        id: it.id,
        purchase_order_id: it.purchase_order_id,
        item_id: it.item_id,
        item_name: it.items?.name ?? "—",
        item_sku: it.items?.sku ?? null,
        item_unit: it.items?.unit ?? "UN",
        quantity: Number(it.quantity),
        received_quantity: Number(it.received_quantity),
        unit_cost: Number(it.unit_cost),
        total_cost: Number(it.total_cost),
      })) as PurchaseOrderItem[],
    };
  });

// ============================================================
// SAVE (create / update DRAFT or PENDING)
// ============================================================
async function generateOrderNumber(sb: any, companyId: string) {
  const year = new Date().getFullYear();
  const { count } = await sb
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", `${year}-01-01`);
  return `PC-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

export const savePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");

    let orderId = data.id;

    if (orderId) {
      // Update existing — only allowed in DRAFT or PENDING
      const { data: existing } = await sb.from("purchase_orders").select("status").eq("id", orderId).maybeSingle();
      if (!existing) throw new Error("Pedido não encontrado.");
      if (!["DRAFT", "PENDING"].includes(existing.status)) {
        throw new Error("Pedido não pode ser editado neste status.");
      }
      const { error } = await sb.from("purchase_orders").update({
        supplier_id: data.supplier_id,
        issue_date: data.issue_date,
        expected_delivery_date: data.expected_delivery_date || null,
        notes: data.notes || null,
      }).eq("id", orderId);
      if (error) throw new Error(error.message);

      // Replace items
      await sb.from("purchase_order_items").delete().eq("purchase_order_id", orderId);
    } else {
      const orderNumber = data.order_number?.trim() || await generateOrderNumber(sb, profile.company_id);
      const { data: row, error } = await sb.from("purchase_orders").insert({
        company_id: profile.company_id,
        supplier_id: data.supplier_id,
        order_number: orderNumber,
        status: "DRAFT",
        issue_date: data.issue_date,
        expected_delivery_date: data.expected_delivery_date || null,
        notes: data.notes || null,
        created_by: context.userId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      orderId = row.id as string;
    }

    // Insert items
    const itemsPayload = data.items.map((it) => ({
      purchase_order_id: orderId,
      item_id: it.item_id,
      quantity: it.quantity,
      unit_cost: it.unit_cost,
    }));
    const { error: ie } = await sb.from("purchase_order_items").insert(itemsPayload);
    if (ie) throw new Error(ie.message);

    await sb.rpc("log_audit", {
      _module: "purchases",
      _action: data.id ? "update" : "create",
      _record_id: orderId,
      _new_data: { supplier_id: data.supplier_id, items_count: data.items.length },
    });

    return { id: orderId };
  });

// ============================================================
// STATUS TRANSITIONS
// ============================================================
async function transitionStatus(
  sb: any,
  userId: string,
  id: string,
  from: PurchaseOrderStatus[],
  to: PurchaseOrderStatus,
  extra: Record<string, any> = {},
) {
  const { data: current } = await sb.from("purchase_orders").select("status, order_number").eq("id", id).maybeSingle();
  if (!current) throw new Error("Pedido não encontrado.");
  if (!from.includes(current.status)) {
    throw new Error(`Transição inválida (de ${current.status} para ${to}).`);
  }
  const { error } = await sb.from("purchase_orders").update({ status: to, ...extra }).eq("id", id);
  if (error) throw new Error(error.message);
  await sb.rpc("log_audit", { _module: "purchases", _action: to.toLowerCase(), _record_id: id, _new_data: { ...extra, status: to } });
  return current.order_number as string;
}

export const submitPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await transitionStatus(sb, context.userId, data.id, ["DRAFT"], "PENDING");
    return { ok: true };
  });

export const approvePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await transitionStatus(sb, context.userId, data.id, ["DRAFT", "PENDING"], "APPROVED", {
      approved_by: context.userId,
      approved_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const cancelPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await transitionStatus(
      sb, context.userId, data.id,
      ["DRAFT", "PENDING", "APPROVED", "PARTIALLY_RECEIVED"],
      "CANCELLED",
      { cancelled_by: context.userId, cancelled_at: new Date().toISOString(), cancellation_reason: data.reason || null },
    );
    return { ok: true };
  });

export const deletePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: po } = await sb.from("purchase_orders").select("status").eq("id", data.id).maybeSingle();
    if (!po) throw new Error("Pedido não encontrado.");
    if (po.status !== "DRAFT") throw new Error("Apenas rascunhos podem ser excluídos.");
    const { error } = await sb.from("purchase_orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", { _module: "purchases", _action: "delete", _record_id: data.id });
    return { ok: true };
  });

export const duplicatePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");

    const { data: po } = await sb.from("purchase_orders").select("*").eq("id", data.id).maybeSingle();
    if (!po) throw new Error("Pedido não encontrado.");
    const { data: items } = await sb.from("purchase_order_items").select("item_id, quantity, unit_cost").eq("purchase_order_id", data.id);

    const orderNumber = await generateOrderNumber(sb, profile.company_id);
    const { data: row, error } = await sb.from("purchase_orders").insert({
      company_id: profile.company_id,
      supplier_id: po.supplier_id,
      order_number: orderNumber,
      status: "DRAFT",
      issue_date: new Date().toISOString().slice(0, 10),
      expected_delivery_date: null,
      notes: po.notes,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);

    if (items?.length) {
      await sb.from("purchase_order_items").insert(items.map((it: any) => ({
        purchase_order_id: row.id,
        item_id: it.item_id,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
      })));
    }
    return { id: row.id as string };
  });

// ============================================================
// RECEIVE
// ============================================================
const receiveSchema = z.object({
  id: z.string().uuid(),
  location_id: z.string().uuid(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  items: z.array(z.object({
    poi_id: z.string().uuid(),
    quantity: z.number().min(0),
  })).min(1),
});

export const receivePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => receiveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const itemsToReceive = data.items.filter((i) => i.quantity > 0);
    if (!itemsToReceive.length) throw new Error("Informe ao menos um item com quantidade > 0.");
    const { data: res, error } = await sb.rpc("receive_purchase_order", {
      _po_id: data.id,
      _location_id: data.location_id,
      _items: itemsToReceive,
      _notes: data.notes || null,
    });
    if (error) throw new Error(error.message);
    return res as { status: PurchaseOrderStatus; movements: string[] };
  });

// ============================================================
// OVERVIEW
// ============================================================
export const purchaseOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { data: rows } = await sb
      .from("purchase_orders")
      .select("status, total_amount, issue_date")
      .gte("issue_date", monthStart.toISOString().slice(0, 10));
    const total = (rows ?? []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
    const pending = (rows ?? []).filter((r: any) => ["PENDING", "APPROVED", "PARTIALLY_RECEIVED"].includes(r.status)).length;
    const received = (rows ?? []).filter((r: any) => r.status === "RECEIVED").length;
    return { monthTotal: total, monthPending: pending, monthReceived: received, count: rows?.length ?? 0 };
  });

// ============================================================
// ANALYTICS (Dashboard de Compras)
// ============================================================
export type PurchaseAnalyticsRange = "30d" | "90d" | "6m" | "12m" | "ytd";

function rangeStart(range: PurchaseAnalyticsRange): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  switch (range) {
    case "30d": d.setDate(d.getDate() - 30); break;
    case "90d": d.setDate(d.getDate() - 90); break;
    case "6m": d.setMonth(d.getMonth() - 6); d.setDate(1); break;
    case "12m": d.setMonth(d.getMonth() - 12); d.setDate(1); break;
    case "ytd": d.setMonth(0); d.setDate(1); break;
  }
  return d;
}

export const purchaseAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    range: z.enum(["30d", "90d", "6m", "12m", "ytd"]).default("90d"),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const start = rangeStart(data.range);
    const startISO = start.toISOString().slice(0, 10);

    // Orders in range
    const { data: orders, error } = await sb
      .from("purchase_orders")
      .select("id, status, total_amount, issue_date, approved_at, supplier_id, updated_at, suppliers:supplier_id(corporate_name, trade_name)")
      .gte("issue_date", startISO)
      .order("issue_date", { ascending: true });
    if (error) throw new Error(error.message);

    const list = (orders ?? []) as any[];
    const nonCancelled = list.filter((o) => o.status !== "CANCELLED");

    // KPIs
    const totalAmount = nonCancelled.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const ordersCount = nonCancelled.length;
    const avgTicket = ordersCount ? totalAmount / ordersCount : 0;
    const receivedCount = nonCancelled.filter((o) => o.status === "RECEIVED").length;
    const pendingCount = nonCancelled.filter((o) => ["DRAFT", "PENDING", "APPROVED", "PARTIALLY_RECEIVED"].includes(o.status)).length;
    const cancelledCount = list.length - nonCancelled.length;
    const fillRate = ordersCount ? (receivedCount / ordersCount) * 100 : 0;

    // Lead time (approved_at -> updated_at when RECEIVED) in days
    const receivedWithApproval = nonCancelled.filter(
      (o) => o.status === "RECEIVED" && o.approved_at,
    );
    const leadTimes = receivedWithApproval.map((o) => {
      const a = new Date(o.approved_at).getTime();
      const r = new Date(o.updated_at).getTime();
      return (r - a) / (1000 * 60 * 60 * 24);
    });
    const avgLeadTime = leadTimes.length
      ? leadTimes.reduce((s, n) => s + n, 0) / leadTimes.length
      : 0;

    // Monthly evolution
    const monthMap = new Map<string, { month: string; total: number; count: number }>();
    for (const o of nonCancelled) {
      const key = String(o.issue_date).slice(0, 7); // YYYY-MM
      const rec = monthMap.get(key) || { month: key, total: 0, count: 0 };
      rec.total += Number(o.total_amount || 0);
      rec.count += 1;
      monthMap.set(key, rec);
    }
    const monthly = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Status distribution (all incl. cancelled)
    const statusMap = new Map<string, number>();
    for (const o of list) statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
    const statusDist = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    // Top suppliers (by amount, non-cancelled)
    const supMap = new Map<string, { supplier_id: string; name: string; total: number; orders: number }>();
    for (const o of nonCancelled) {
      if (!o.supplier_id) continue;
      const name = o.suppliers?.trade_name || o.suppliers?.corporate_name || "—";
      const rec = supMap.get(o.supplier_id) || { supplier_id: o.supplier_id, name, total: 0, orders: 0 };
      rec.total += Number(o.total_amount || 0);
      rec.orders += 1;
      supMap.set(o.supplier_id, rec);
    }
    const topSuppliers = Array.from(supMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top items (need line items)
    const orderIds = nonCancelled.map((o) => o.id);
    let topItems: { item_id: string; name: string; sku: string | null; qty: number; total: number }[] = [];
    if (orderIds.length) {
      const { data: lines } = await sb
        .from("purchase_order_items")
        .select("item_id, quantity, total_cost, items:item_id(name, sku)")
        .in("purchase_order_id", orderIds);
      const itMap = new Map<string, { item_id: string; name: string; sku: string | null; qty: number; total: number }>();
      for (const l of (lines ?? []) as any[]) {
        const rec = itMap.get(l.item_id) || {
          item_id: l.item_id,
          name: l.items?.name ?? "—",
          sku: l.items?.sku ?? null,
          qty: 0,
          total: 0,
        };
        rec.qty += Number(l.quantity || 0);
        rec.total += Number(l.total_cost || 0);
        itMap.set(l.item_id, rec);
      }
      topItems = Array.from(itMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);
    }

    return {
      range: data.range,
      startDate: startISO,
      kpis: {
        totalAmount,
        ordersCount,
        avgTicket,
        receivedCount,
        pendingCount,
        cancelledCount,
        fillRate,
        avgLeadTime,
        suppliersActive: supMap.size,
      },
      monthly,
      statusDist,
      topSuppliers,
      topItems,
    };
  });
