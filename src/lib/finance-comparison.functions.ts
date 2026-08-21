import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RangeSchema = z.object({
  aFrom: z.string(),
  aTo: z.string(),
  bFrom: z.string(),
  bTo: z.string(),
});

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa.");
  return cid;
}

export type PeriodTotals = {
  income: number;
  expense: number;
  balance: number;
};

export type CategoryRow = {
  category_id: string | null;
  name: string;
  type: "INCOME" | "EXPENSE";
  a: number;
  b: number;
  deltaAbs: number;
};

export type MonthRow = {
  month: string; // "YYYY-MM"
  a_income: number;
  a_expense: number;
  b_income: number;
  b_expense: number;
};

export type FinancialComparison = {
  a: PeriodTotals;
  b: PeriodTotals;
  byCategory: CategoryRow[];
  byMonth: MonthRow[];
  companyId: string;
};

function inRange(iso: string | null, from: string, to: string) {
  if (!iso) return false;
  return iso >= from && iso <= to;
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export const getFinancialComparison = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d))
  .handler(async ({ data, context }): Promise<FinancialComparison> => {
    const cid = await getCompanyId(context.supabase, context.userId);

    const minFrom = data.aFrom < data.bFrom ? data.aFrom : data.bFrom;
    const maxTo = data.aTo > data.bTo ? data.aTo : data.bTo;

    const { data: rows, error } = await context.supabase
      .from("financial_transactions")
      .select("id,type,amount,status,paid_at,category_id,financial_categories(name)")
      .eq("company_id", cid)
      .eq("status", "PAID")
      .is("deleted_at", null)
      .not("paid_at", "is", null)
      .gte("paid_at", minFrom)
      .lte("paid_at", maxTo);
    if (error) throw error;

    const a: PeriodTotals = { income: 0, expense: 0, balance: 0 };
    const b: PeriodTotals = { income: 0, expense: 0, balance: 0 };
    const catMap = new Map<string, CategoryRow>();
    const monthMap = new Map<string, MonthRow>();

    for (const r of rows ?? []) {
      const amt = Number((r as any).amount ?? 0);
      const paidAt = (r as any).paid_at as string;
      const type = (r as any).type as "INCOME" | "EXPENSE";
      const inA = inRange(paidAt, data.aFrom, data.aTo);
      const inB = inRange(paidAt, data.bFrom, data.bTo);
      if (!inA && !inB) continue;

      if (inA) {
        if (type === "INCOME") a.income += amt;
        else a.expense += amt;
      }
      if (inB) {
        if (type === "INCOME") b.income += amt;
        else b.expense += amt;
      }

      const catId = ((r as any).category_id as string | null) ?? "__none__";
      const catName =
        ((r as any).financial_categories?.name as string | undefined) ?? "Sem categoria";
      const key = `${type}:${catId}`;
      let row = catMap.get(key);
      if (!row) {
        row = {
          category_id: catId === "__none__" ? null : catId,
          name: catName,
          type,
          a: 0,
          b: 0,
          deltaAbs: 0,
        };
        catMap.set(key, row);
      }
      if (inA) row.a += amt;
      if (inB) row.b += amt;

      const mk = monthKey(paidAt);
      let mrow = monthMap.get(mk);
      if (!mrow) {
        mrow = { month: mk, a_income: 0, a_expense: 0, b_income: 0, b_expense: 0 };
        monthMap.set(mk, mrow);
      }
      if (inA) {
        if (type === "INCOME") mrow.a_income += amt;
        else mrow.a_expense += amt;
      }
      if (inB) {
        if (type === "INCOME") mrow.b_income += amt;
        else mrow.b_expense += amt;
      }
    }

    a.balance = a.income - a.expense;
    b.balance = b.income - b.expense;

    const byCategory = Array.from(catMap.values())
      .map((r) => ({ ...r, deltaAbs: r.a - r.b }))
      .filter((r) => r.a !== 0 || r.b !== 0)
      .sort((x, y) => Math.abs(y.deltaAbs) - Math.abs(x.deltaAbs));

    const byMonth = Array.from(monthMap.values()).sort((x, y) => x.month.localeCompare(y.month));

    return { a, b, byCategory, byMonth, companyId: cid };
  });
