import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  months: z.union([z.literal(3), z.literal(6), z.literal(12)]).default(3),
});

export type ProfitBoosterBaseline = {
  avgIncome: number;
  avgExpense: number;
  avgVariableExpense: number;
  monthlyFixedCosts: number;
  avgProfit: number;
  avgMargin: number | null;
  monthsUsed: number;
  hasAnyPaidLast12Months: boolean;
  fixedCostsConfigured: boolean;
};

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

function firstDayNMonthsAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (n - 1));
  return d.toISOString().slice(0, 10);
}

export const getProfitBoosterBaseline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<ProfitBoosterBaseline> => {
    const cid = await getCompanyId(context.supabase, context.userId);

    const from = firstDayNMonthsAgo(data.months);
    const from12 = firstDayNMonthsAgo(12);
    const today = new Date().toISOString().slice(0, 10);

    const { data: rows, error } = await context.supabase
      .from("financial_transactions")
      .select("type,amount,paid_at")
      .eq("company_id", cid)
      .eq("status", "PAID")
      .is("deleted_at", null)
      .not("paid_at", "is", null)
      .gte("paid_at", from12)
      .lte("paid_at", today);
    if (error) throw error;

    const inWindow = (iso: string | null) => !!iso && iso >= from && iso <= today;

    let income = 0;
    let expense = 0;
    let hasAny = false;
    for (const r of rows ?? []) {
      const amt = Number(r.amount ?? 0);
      if (!Number.isFinite(amt)) continue;
      if (r.paid_at) hasAny = true;
      if (!inWindow(r.paid_at)) continue;
      if (r.type === "INCOME") income += amt;
      else if (r.type === "EXPENSE") expense += amt;
    }

    const monthsUsed = data.months;
    const avgIncome = income / monthsUsed;
    const avgExpense = expense / monthsUsed;

    const { data: cs } = await context.supabase
      .from("company_cost_settings")
      .select("monthly_fixed_costs_total")
      .eq("company_id", cid)
      .maybeSingle();
    const monthlyFixedCosts = Number(cs?.monthly_fixed_costs_total ?? 0) || 0;
    const fixedCostsConfigured = monthlyFixedCosts > 0;

    const avgVariableExpense = Math.max(0, avgExpense - monthlyFixedCosts);
    const avgProfit = avgIncome - avgExpense;
    const avgMargin = avgIncome > 0 ? (avgProfit / avgIncome) * 100 : null;

    return {
      avgIncome,
      avgExpense,
      avgVariableExpense,
      monthlyFixedCosts,
      avgProfit,
      avgMargin,
      monthsUsed,
      hasAnyPaidLast12Months: hasAny,
      fixedCostsConfigured,
    };
  });
