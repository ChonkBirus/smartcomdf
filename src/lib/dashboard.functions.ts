import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dashboardFiltersSchema = z
  .object({
    from: z.string().datetime().nullable().optional(),
    to: z.string().datetime().nullable().optional(),
  })
  .default({});

export type DashboardMetrics = {
  customers: { total: number; newThisPeriod: number; pf: number; pj: number };
  quotes: {
    total: number;
    createdThisPeriod: number;
    pending: number;
    approved: number;
    expired: number;
    totalAmount: number;
    approvedAmount: number;
    conversionRate: number;
  };
  projects: { total: number; active: number; completed: number };
  serviceOrders: { total: number; scheduled: number; inProgress: number; completed: number; overdue: number };
  stock: { products: number; services: number; lowStock: number; outOfStock: number; recentMovements: number };
  payments: { waiting: number; approved: number; waitingAmount: number; approvedAmount: number };
  recentActivity: Array<{ id: string; label: string; created_at: string }>;
  charts: { quotesByStatus: Array<{ status: string; count: number }> };
};

export const emptyDashboardMetrics: DashboardMetrics = {
  customers: { total: 0, newThisPeriod: 0, pf: 0, pj: 0 },
  quotes: {
    total: 0,
    createdThisPeriod: 0,
    pending: 0,
    approved: 0,
    expired: 0,
    totalAmount: 0,
    approvedAmount: 0,
    conversionRate: 0,
  },
  projects: { total: 0, active: 0, completed: 0 },
  serviceOrders: { total: 0, scheduled: 0, inProgress: 0, completed: 0, overdue: 0 },
  stock: { products: 0, services: 0, lowStock: 0, outOfStock: 0, recentMovements: 0 },
  payments: { waiting: 0, approved: 0, waitingAmount: 0, approvedAmount: 0 },
  recentActivity: [],
  charts: { quotesByStatus: [] },
};

const isDev = typeof process !== "undefined" ? process.env.NODE_ENV !== "production" : true;
const monthStart = () => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};
const asNumber = (value: unknown) => Number(value ?? 0) || 0;
const statusText = (value: unknown) => String(value ?? "").toUpperCase();
const sum = <T,>(rows: T[], pick: (row: T) => unknown) => rows.reduce((acc, row) => acc + asNumber(pick(row)), 0);

function logDashboardBlockError(block: string, error: unknown) {
  if (!isDev) return;
  console.error(`[DASHBOARD ERROR] ${block}`, error);
}

function applyDateRange(query: any, from: string | null, to: string | null) {
  let scoped = query;
  if (from) scoped = scoped.gte("created_at", from);
  if (to) scoped = scoped.lte("created_at", to);
  return scoped;
}

async function getCompanyId(sb: any, userId: string): Promise<string | null> {
  const { data, error } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (error) {
    logDashboardBlockError("company", error);
    return null;
  }
  return data?.company_id ?? null;
}

async function getCustomersMetrics(sb: any, companyId: string, from: string | null, to: string | null): Promise<DashboardMetrics["customers"]> {
  try {
    const { data, error } = await sb
      .from("customers")
      .select("id, customer_type, created_at")
      .eq("company_id", companyId)
      .eq("active", true)
      .is("deleted_at", null)
      .limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    const periodStart = from ?? monthStart();
    const periodEnd = to ?? new Date().toISOString();
    return {
      total: rows.length,
      newThisPeriod: rows.filter((row: any) => row.created_at >= periodStart && row.created_at <= periodEnd).length,
      pf: rows.filter((row: any) => statusText(row.customer_type) === "INDIVIDUAL").length,
      pj: rows.filter((row: any) => statusText(row.customer_type) === "COMPANY").length,
    };
  } catch (error) {
    logDashboardBlockError("customers", error);
    return emptyDashboardMetrics.customers;
  }
}

async function getQuotesMetrics(sb: any, companyId: string, from: string | null, to: string | null) {
  try {
    const { data, error } = await applyDateRange(
      sb
        .from("quotes")
        .select("id, status, total_amount, created_at")
        .eq("company_id", companyId),
      from,
      to,
    ).limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    const pendingStatuses = new Set(["DRAFT", "SENT", "VIEWED"]);
    const approved = rows.filter((row: any) => statusText(row.status) === "APPROVED");
    const total = rows.length;
    const quotesByStatus = new Map<string, number>();
    for (const row of rows) {
      const key = statusText((row as any).status) || "SEM_STATUS";
      quotesByStatus.set(key, (quotesByStatus.get(key) ?? 0) + 1);
    }
    return {
      quotes: {
        total,
        createdThisPeriod: total,
        pending: rows.filter((row: any) => pendingStatuses.has(statusText(row.status))).length,
        approved: approved.length,
        expired: rows.filter((row: any) => statusText(row.status) === "EXPIRED").length,
        totalAmount: sum(rows, (row: any) => row.total_amount),
        approvedAmount: sum(approved, (row: any) => row.total_amount),
        conversionRate: total > 0 ? (approved.length / total) * 100 : 0,
      },
      charts: {
        quotesByStatus: Array.from(quotesByStatus.entries()).map(([status, count]) => ({ status, count })),
      },
    } satisfies Pick<DashboardMetrics, "quotes" | "charts">;
  } catch (error) {
    logDashboardBlockError("quotes", error);
    return { quotes: emptyDashboardMetrics.quotes, charts: emptyDashboardMetrics.charts };
  }
}

async function getProjectsMetrics(sb: any, companyId: string): Promise<DashboardMetrics["projects"]> {
  try {
    const { data, error } = await sb
      .from("projects")
      .select("id, status")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    const activeStatuses = new Set(["PLANNING", "IN_PROGRESS", "READY_FOR_OS"]);
    return {
      total: rows.length,
      active: rows.filter((row: any) => activeStatuses.has(statusText(row.status))).length,
      completed: rows.filter((row: any) => statusText(row.status) === "COMPLETED").length,
    };
  } catch (error) {
    logDashboardBlockError("projects", error);
    return emptyDashboardMetrics.projects;
  }
}

async function getServiceOrdersMetrics(sb: any, companyId: string): Promise<DashboardMetrics["serviceOrders"]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb
      .from("service_orders")
      .select("id, status, scheduled_date")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    return {
      total: rows.length,
      scheduled: rows.filter((row: any) => statusText(row.status) === "SCHEDULED").length,
      inProgress: rows.filter((row: any) => statusText(row.status) === "IN_PROGRESS").length,
      completed: rows.filter((row: any) => statusText(row.status) === "COMPLETED").length,
      overdue: rows.filter((row: any) => {
        const status = statusText(row.status);
        return row.scheduled_date && row.scheduled_date < today && !["COMPLETED", "CANCELLED"].includes(status);
      }).length,
    };
  } catch (error) {
    logDashboardBlockError("service_orders", error);
    return emptyDashboardMetrics.serviceOrders;
  }
}

async function getStockMetrics(sb: any, companyId: string): Promise<DashboardMetrics["stock"]> {
  try {
    const { data: items, error: itemsError } = await sb
      .from("items")
      .select("id, item_type, controls_stock, minimum_stock")
      .eq("company_id", companyId)
      .eq("active", true)
      .is("deleted_at", null)
      .limit(5000);
    if (itemsError) throw itemsError;

    const rows = items ?? [];
    const stockItems = rows.filter((item: any) => item.controls_stock && statusText(item.item_type) === "PRODUCT");
    const [balancesRes, movementsRes] = await Promise.all([
      sb.from("stock_balances").select("item_id, quantity").eq("company_id", companyId),
      sb.from("stock_movements").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    ]);
    if (balancesRes.error) throw balancesRes.error;
    if (movementsRes.error) throw movementsRes.error;

    const totalByItem = new Map<string, number>();
    for (const balance of balancesRes.data ?? []) {
      totalByItem.set(balance.item_id, (totalByItem.get(balance.item_id) ?? 0) + asNumber(balance.quantity));
    }

    let lowStock = 0;
    let outOfStock = 0;
    for (const item of stockItems) {
      const quantity = totalByItem.get(item.id) ?? 0;
      const minimum = asNumber(item.minimum_stock);
      if (quantity <= 0) outOfStock += 1;
      else if (minimum > 0 && quantity <= minimum) lowStock += 1;
    }

    return {
      products: rows.filter((item: any) => statusText(item.item_type) === "PRODUCT").length,
      services: rows.filter((item: any) => statusText(item.item_type) === "SERVICE").length,
      lowStock,
      outOfStock,
      recentMovements: movementsRes.count ?? 0,
    };
  } catch (error) {
    logDashboardBlockError("stock", error);
    return emptyDashboardMetrics.stock;
  }
}

async function getPaymentsMetrics(sb: any, companyId: string): Promise<DashboardMetrics["payments"]> {
  try {
    const { data, error } = await sb
      .from("quote_payments")
      .select("id, amount, payment_status")
      .eq("company_id", companyId)
      .limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    const waiting = rows.filter((row: any) => ["PENDING", "WAITING_PAYMENT"].includes(statusText(row.payment_status)));
    const approved = rows.filter((row: any) => ["APPROVED", "PAYMENT_APPROVED"].includes(statusText(row.payment_status)));
    return {
      waiting: waiting.length,
      approved: approved.length,
      waitingAmount: sum(waiting, (row: any) => row.amount),
      approvedAmount: sum(approved, (row: any) => row.amount),
    };
  } catch (error) {
    logDashboardBlockError("payments", error);
    return emptyDashboardMetrics.payments;
  }
}

async function getRecentActivity(sb: any, companyId: string): Promise<DashboardMetrics["recentActivity"]> {
  try {
    const { data, error } = await sb
      .from("activity_logs")
      .select("id, description, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      label: row.description ?? "Atividade registrada",
      created_at: row.created_at,
    }));
  } catch (error) {
    logDashboardBlockError("recent_activity", error);
    return [];
  }
}

export const getDashboardMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => dashboardFiltersSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<DashboardMetrics> => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    if (!companyId) return emptyDashboardMetrics;

    const from = data.from ?? null;
    const to = data.to ?? null;

    const [customers, quoteResult, projects, serviceOrders, stock, payments, recentActivity] = await Promise.all([
      getCustomersMetrics(sb, companyId, from, to),
      getQuotesMetrics(sb, companyId, from, to),
      getProjectsMetrics(sb, companyId),
      getServiceOrdersMetrics(sb, companyId),
      getStockMetrics(sb, companyId),
      getPaymentsMetrics(sb, companyId),
      getRecentActivity(sb, companyId),
    ]);

    return {
      customers,
      quotes: quoteResult.quotes,
      projects,
      serviceOrders,
      stock,
      payments,
      recentActivity,
      charts: quoteResult.charts,
    };
  });