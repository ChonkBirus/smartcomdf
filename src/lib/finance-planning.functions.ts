import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
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

async function assertPermission(supabase: any, userId: string, slug: string) {
  const { data: roles } = await supabase
    .from("profile_roles")
    .select("roles!inner(slug)")
    .eq("profile_id", userId);
  const roleSlugs = (roles ?? []).map((r: any) => r.roles?.slug).filter(Boolean);
  if (roleSlugs.includes("super_admin") || roleSlugs.includes("owner")) return;
  const { data: perm } = await supabase
    .from("permissions")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!perm?.id) throw new Error("Permissão não configurada.");
  const { data: rp } = await supabase
    .from("role_permissions")
    .select("roles!inner(slug)")
    .eq("permission_id", perm.id);
  const allowed = (rp ?? []).some((r: any) => roleSlugs.includes(r.roles?.slug));
  if (!allowed) throw new Error("Sem permissão.");
}

// ---------- types ----------
export type MonthlyPlan = {
  id: string;
  year: number;
  month: number;
  revenue_goal: number | null;
  expense_cap: number | null;
  profit_goal: number | null;
  margin_goal_pct: number | null;
  cash_min: number | null;
  notes: string | null;
};

export type MonthlyActual = {
  income: number;
  expense: number;
  balance: number;
  margin: number | null; // null when income = 0
};

export type YearlyPlanRow = {
  month: number;
  plan: MonthlyPlan | null;
  actual: MonthlyActual;
};

// ---------- getYearlyPlan ----------
export const getYearlyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ year: z.number().int().min(2000).max(2100) }).parse(d))
  .handler(async ({ data, context }): Promise<{ year: number; rows: YearlyPlanRow[] }> => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const from = `${data.year}-01-01`;
    const to = `${data.year}-12-31`;

    const [{ data: plans, error: pe }, { data: tx, error: te }] = await Promise.all([
      context.supabase
        .from("finance_monthly_plans")
        .select("*")
        .eq("company_id", cid)
        .eq("year", data.year),
      context.supabase
        .from("financial_transactions")
        .select("type,amount,paid_at")
        .eq("company_id", cid)
        .eq("status", "PAID")
        .is("deleted_at", null)
        .not("paid_at", "is", null)
        .gte("paid_at", from)
        .lte("paid_at", to),
    ]);
    if (pe) throw pe;
    if (te) throw te;

    const planByMonth = new Map<number, MonthlyPlan>();
    for (const p of plans ?? []) {
      planByMonth.set((p as any).month, {
        id: (p as any).id,
        year: (p as any).year,
        month: (p as any).month,
        revenue_goal: (p as any).revenue_goal != null ? Number((p as any).revenue_goal) : null,
        expense_cap: (p as any).expense_cap != null ? Number((p as any).expense_cap) : null,
        profit_goal: (p as any).profit_goal != null ? Number((p as any).profit_goal) : null,
        margin_goal_pct:
          (p as any).margin_goal_pct != null ? Number((p as any).margin_goal_pct) : null,
        cash_min: (p as any).cash_min != null ? Number((p as any).cash_min) : null,
        notes: (p as any).notes ?? null,
      });
    }

    const actualByMonth = new Map<number, { income: number; expense: number }>();
    for (let m = 1; m <= 12; m++) actualByMonth.set(m, { income: 0, expense: 0 });
    for (const r of tx ?? []) {
      const paidAt = (r as any).paid_at as string;
      const m = Number(paidAt.slice(5, 7));
      const amt = Number((r as any).amount ?? 0);
      const bucket = actualByMonth.get(m)!;
      if ((r as any).type === "INCOME") bucket.income += amt;
      else bucket.expense += amt;
    }

    const rows: YearlyPlanRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const a = actualByMonth.get(m)!;
      const balance = a.income - a.expense;
      const margin = a.income > 0 ? (balance / a.income) * 100 : null;
      rows.push({
        month: m,
        plan: planByMonth.get(m) ?? null,
        actual: { income: a.income, expense: a.expense, balance, margin },
      });
    }

    return { year: data.year, rows };
  });

// ---------- upsertMonthlyPlan ----------
const PlanFieldsSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  revenue_goal: z.number().nullable().optional(),
  expense_cap: z.number().nullable().optional(),
  profit_goal: z.number().nullable().optional(),
  margin_goal_pct: z.number().nullable().optional(),
  cash_min: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const upsertMonthlyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanFieldsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "finance.planning.manage");
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("finance_monthly_plans")
      .upsert(
        {
          company_id: cid,
          created_by: context.userId,
          year: data.year,
          month: data.month,
          revenue_goal: data.revenue_goal ?? null,
          expense_cap: data.expense_cap ?? null,
          profit_goal: data.profit_goal ?? null,
          margin_goal_pct: data.margin_goal_pct ?? null,
          cash_min: data.cash_min ?? null,
          notes: data.notes ?? null,
        },
        { onConflict: "company_id,year,month" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ---------- deleteMonthlyPlan ----------
export const deleteMonthlyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "finance.planning.manage");
    const cid = await getCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("finance_monthly_plans")
      .delete()
      .eq("company_id", cid)
      .eq("year", data.year)
      .eq("month", data.month);
    if (error) throw error;
    return { ok: true };
  });

// ---------- copyPreviousMonth ----------
export const copyPreviousMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "finance.planning.manage");
    const cid = await getCompanyId(context.supabase, context.userId);
    const prevMonth = data.month === 1 ? 12 : data.month - 1;
    const prevYear = data.month === 1 ? data.year - 1 : data.year;
    const { data: prev, error: pe } = await context.supabase
      .from("finance_monthly_plans")
      .select("*")
      .eq("company_id", cid)
      .eq("year", prevYear)
      .eq("month", prevMonth)
      .maybeSingle();
    if (pe) throw pe;
    if (!prev) return { ok: false, reason: "no_previous" as const };
    const { error } = await context.supabase.from("finance_monthly_plans").upsert(
      {
        company_id: cid,
        created_by: context.userId,
        year: data.year,
        month: data.month,
        revenue_goal: prev.revenue_goal,
        expense_cap: prev.expense_cap,
        profit_goal: prev.profit_goal,
        margin_goal_pct: prev.margin_goal_pct,
        cash_min: prev.cash_min,
        notes: prev.notes,
      },
      { onConflict: "company_id,year,month" },
    );
    if (error) throw error;
    return { ok: true as const };
  });

// ---------- applyPlanToWholeYear ----------
export const applyPlanToWholeYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ year: z.number().int(), sourceMonth: z.number().int().min(1).max(12) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "finance.planning.manage");
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: src, error: se } = await context.supabase
      .from("finance_monthly_plans")
      .select("*")
      .eq("company_id", cid)
      .eq("year", data.year)
      .eq("month", data.sourceMonth)
      .maybeSingle();
    if (se) throw se;
    if (!src) throw new Error("Mês de origem não possui meta cadastrada.");
    const rows = [];
    for (let m = 1; m <= 12; m++) {
      if (m === data.sourceMonth) continue;
      rows.push({
        company_id: cid,
        created_by: context.userId,
        year: data.year,
        month: m,
        revenue_goal: src.revenue_goal,
        expense_cap: src.expense_cap,
        profit_goal: src.profit_goal,
        margin_goal_pct: src.margin_goal_pct,
        cash_min: src.cash_min,
        notes: src.notes,
      });
    }
    const { error } = await context.supabase
      .from("finance_monthly_plans")
      .upsert(rows, { onConflict: "company_id,year,month" });
    if (error) throw error;
    return { ok: true, applied: rows.length };
  });
