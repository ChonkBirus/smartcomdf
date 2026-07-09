import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOriginTypeLabel } from "@/lib/finance-origin";

const FiltersSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
  })
  .default({});

type Bucket = { id: string | null; name: string; total: number; count: number };

export type OriginSummaryRow = {
  origin_type: string;
  label: string;
  type: "INCOME" | "EXPENSE";
  realized_total: number;
  realized_count: number;
  planned_total: number;
  planned_count: number;
  total: number;
  count: number;
};

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa.");
  return data.company_id as string;
}

export type FinanceReportSummary = {
  income: number;
  expense: number;
  balance: number;
  receivables: number;
  payables: number;
  overdueReceivables: number;
  overduePayables: number;
  incomeByCategory: Bucket[];
  expenseByCategory: Bucket[];
  receivablesByStatus: Array<{ status: string; total: number; count: number }>;
  payablesByStatus: Array<{ status: string; total: number; count: number }>;
  monthly: Array<{ month: string; income: number; expense: number; balance: number }>;
  originSummary: OriginSummaryRow[];
  originCards: {
    quotePaymentsPaid: number;
    quoteReceivables: number;
    purchasesPlanned: number;
    purchasesPaid: number;
    manualExpense: number;
    serviceOrderCosts: number;
  };
  count: number;
};

function todayIso(): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

const REALIZED = new Set(["PAID", "RECONCILED"]);
const PLANNED_SET = new Set(["PLANNED", "OVERDUE"]);

export const getFinanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d))
  .handler(async ({ data, context }): Promise<FinanceReportSummary> => {
    const { supabase, userId } = context as any;
    const companyId = await getCompanyId(supabase, userId);
    const today = todayIso();

    let q = supabase
      .from("financial_transactions")
      .select("id,type,status,amount,due_date,paid_at,category_id,origin_type,financial_categories(name)")
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.customerId) q = q.eq("customer_id", data.customerId);
    if (data.supplierId) q = q.eq("supplier_id", data.supplierId);
    if (data.from) q = q.or(`due_date.gte.${data.from},paid_at.gte.${data.from}`);
    if (data.to) q = q.or(`due_date.lte.${data.to},paid_at.lte.${data.to}`);

    const { data: rows, error } = await q;
    if (error) throw error;

    const list = (rows ?? []) as any[];
    const summary: FinanceReportSummary = {
      income: 0,
      expense: 0,
      balance: 0,
      receivables: 0,
      payables: 0,
      overdueReceivables: 0,
      overduePayables: 0,
      incomeByCategory: [],
      expenseByCategory: [],
      receivablesByStatus: [],
      payablesByStatus: [],
      monthly: [],
      originSummary: [],
      originCards: {
        quotePaymentsPaid: 0,
        quoteReceivables: 0,
        purchasesPlanned: 0,
        purchasesPaid: 0,
        manualExpense: 0,
        serviceOrderCosts: 0,
      },
      count: list.length,
    };

    const incCat = new Map<string, Bucket>();
    const expCat = new Map<string, Bucket>();
    const recStatus = new Map<string, { total: number; count: number }>();
    const payStatus = new Map<string, { total: number; count: number }>();
    const monthly = new Map<string, { income: number; expense: number }>();
    const originMap = new Map<string, OriginSummaryRow>();

    for (const r of list) {
      if (r.status === "CANCELED") continue;
      const amt = Number(r.amount ?? 0);
      const eff =
        r.status === "PLANNED" && r.due_date && r.due_date < today ? "OVERDUE" : r.status;
      const catName = r.financial_categories?.name ?? "Sem categoria";
      const monthKey = (r.paid_at ?? r.due_date ?? "").slice(0, 7);

      if (r.type === "INCOME") {
        if (REALIZED.has(eff)) summary.income += amt;
        if (PLANNED_SET.has(eff)) summary.receivables += amt;
        if (eff === "OVERDUE") summary.overdueReceivables += amt;
        const b = incCat.get(catName) ?? { id: r.category_id, name: catName, total: 0, count: 0 };
        b.total += amt;
        b.count += 1;
        incCat.set(catName, b);
        const s = recStatus.get(eff) ?? { total: 0, count: 0 };
        s.total += amt;
        s.count += 1;
        recStatus.set(eff, s);
      } else {
        if (REALIZED.has(eff)) summary.expense += amt;
        if (PLANNED_SET.has(eff)) summary.payables += amt;
        if (eff === "OVERDUE") summary.overduePayables += amt;
        const b = expCat.get(catName) ?? { id: r.category_id, name: catName, total: 0, count: 0 };
        b.total += amt;
        b.count += 1;
        expCat.set(catName, b);
        const s = payStatus.get(eff) ?? { total: 0, count: 0 };
        s.total += amt;
        s.count += 1;
        payStatus.set(eff, s);
      }

      if (monthKey) {
        const m = monthly.get(monthKey) ?? { income: 0, expense: 0 };
        if (REALIZED.has(eff)) {
          if (r.type === "INCOME") m.income += amt;
          else m.expense += amt;
        }
        monthly.set(monthKey, m);
      }

      // Origin aggregation
      const originType = (r.origin_type ?? "MANUAL").toUpperCase();
      const key = `${originType}::${r.type}`;
      const row =
        originMap.get(key) ??
        {
          origin_type: originType,
          label: getOriginTypeLabel(originType, r.type).label,
          type: r.type as "INCOME" | "EXPENSE",
          realized_total: 0,
          realized_count: 0,
          planned_total: 0,
          planned_count: 0,
          total: 0,
          count: 0,
        };
      if (REALIZED.has(eff)) {
        row.realized_total += amt;
        row.realized_count += 1;
      } else if (PLANNED_SET.has(eff)) {
        row.planned_total += amt;
        row.planned_count += 1;
      }
      row.total += amt;
      row.count += 1;
      originMap.set(key, row);

      // Cards
      if (originType === "QUOTE_PAYMENT" && REALIZED.has(eff)) {
        summary.originCards.quotePaymentsPaid += amt;
      } else if (originType === "QUOTE_RECEIVABLE_BALANCE" && PLANNED_SET.has(eff)) {
        summary.originCards.quoteReceivables += amt;
      } else if (originType === "PURCHASE_ORDER_PAYABLE") {
        if (PLANNED_SET.has(eff)) summary.originCards.purchasesPlanned += amt;
        else if (REALIZED.has(eff)) summary.originCards.purchasesPaid += amt;
      } else if (originType === "MANUAL" && r.type === "EXPENSE" && REALIZED.has(eff)) {
        summary.originCards.manualExpense += amt;
      } else if (originType === "SERVICE_ORDER_COST" && REALIZED.has(eff)) {
        summary.originCards.serviceOrderCosts += amt;
      }
    }

    summary.balance = summary.income - summary.expense;
    summary.incomeByCategory = [...incCat.values()].sort((a, b) => b.total - a.total);
    summary.expenseByCategory = [...expCat.values()].sort((a, b) => b.total - a.total);
    summary.receivablesByStatus = [...recStatus.entries()].map(([status, v]) => ({ status, ...v }));
    summary.payablesByStatus = [...payStatus.entries()].map(([status, v]) => ({ status, ...v }));
    summary.monthly = [...monthly.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([month, v]) => ({ month, income: v.income, expense: v.expense, balance: v.income - v.expense }));
    summary.originSummary = [...originMap.values()].sort((a, b) => b.total - a.total);

    return summary;
  });

