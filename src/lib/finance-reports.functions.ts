import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  count: number;
};

function todayIso(): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

export const getFinanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d))
  .handler(async ({ data, context }): Promise<FinanceReportSummary> => {
    const { supabase, userId } = context as any;
    const companyId = await getCompanyId(supabase, userId);
    const today = todayIso();

    let q = supabase
      .from("financial_transactions")
      .select("id,type,status,amount,due_date,paid_at,category_id,financial_categories(name)")
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
      count: list.length,
    };

    const incCat = new Map<string, Bucket>();
    const expCat = new Map<string, Bucket>();
    const recStatus = new Map<string, { total: number; count: number }>();
    const payStatus = new Map<string, { total: number; count: number }>();
    const monthly = new Map<string, { income: number; expense: number }>();

    for (const r of list) {
      const amt = Number(r.amount ?? 0);
      const eff =
        r.status === "PLANNED" && r.due_date && r.due_date < today ? "OVERDUE" : r.status;
      const catName = r.financial_categories?.name ?? "Sem categoria";
      const monthKey = (r.paid_at ?? r.due_date ?? "").slice(0, 7);

      if (r.type === "INCOME") {
        if (eff === "PAID") summary.income += amt;
        if (eff === "PLANNED" || eff === "OVERDUE") summary.receivables += amt;
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
        if (eff === "PAID") summary.expense += amt;
        if (eff === "PLANNED" || eff === "OVERDUE") summary.payables += amt;
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
        if (eff === "PAID") {
          if (r.type === "INCOME") m.income += amt;
          else m.expense += amt;
        }
        monthly.set(monthKey, m);
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

    return summary;
  });
