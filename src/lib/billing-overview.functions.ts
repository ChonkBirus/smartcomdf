// Super-admin overview metrics: companies, subscriptions, MRR/ARR, webhooks.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Acesso restrito a Super Admins.");
}

export type AdminBillingOverview = {
  totalCompanies: number;
  trialingCount: number;
  activeCount: number;
  pastDueCount: number;
  suspendedCount: number;
  canceledCount: number;
  expiredCount: number;
  manualReviewCount: number;
  paymentsThisMonthCount: number;
  paymentsThisMonthAmount: number;
  mrr: number;
  arr: number;
  webhooksErrorCount: number;
  trialsEndingSoon: Array<{
    subscription_id: string;
    company_id: string;
    company_name: string | null;
    plan_name: string | null;
    trial_ends_at: string;
  }>;
};

export const getAdminBillingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBillingOverview> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const [companiesRes, subsRes, paymentsRes, webhooksRes, trialsRes] = await Promise.all([
      supabaseAdmin.from("companies").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("subscriptions")
        .select(
          "id, status, billing_cycle, monthly_price, yearly_price, plans:plan_id(monthly_price, annual_price)",
        ),
      supabaseAdmin
        .from("billing_charges")
        .select("amount, paid_at, status")
        .eq("status", "RECEIVED")
        .gte("paid_at", monthStart),
      supabaseAdmin
        .from("billing_webhook_events")
        .select("id", { count: "exact", head: true })
        .in("status", ["ERROR", "FAILED"]),
      supabaseAdmin
        .from("subscriptions")
        .select(
          "id, company_id, trial_ends_at, plans:plan_id(name), companies:company_id(trade_name, corporate_name)",
        )
        .eq("status", "TRIALING")
        .not("trial_ends_at", "is", null)
        .gte("trial_ends_at", now.toISOString())
        .lte("trial_ends_at", in3Days)
        .order("trial_ends_at", { ascending: true })
        .limit(20),
    ]);

    const counts = {
      TRIALING: 0,
      ACTIVE: 0,
      PAST_DUE: 0,
      SUSPENDED: 0,
      CANCELED: 0,
      EXPIRED: 0,
      MANUAL_REVIEW: 0,
    } as Record<string, number>;
    let mrr = 0;
    for (const s of (subsRes.data ?? []) as any[]) {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
      if (s.status !== "ACTIVE") continue;
      const monthly = Number(s.monthly_price ?? s.plans?.monthly_price ?? 0);
      const yearly = Number(s.yearly_price ?? s.plans?.annual_price ?? 0);
      mrr += s.billing_cycle === "YEARLY" ? yearly / 12 : monthly;
    }

    const paymentsThisMonthAmount = (paymentsRes.data ?? []).reduce(
      (acc: number, r: any) => acc + Number(r.amount ?? 0),
      0,
    );

    return {
      totalCompanies: companiesRes.count ?? 0,
      trialingCount: counts.TRIALING,
      activeCount: counts.ACTIVE,
      pastDueCount: counts.PAST_DUE,
      suspendedCount: counts.SUSPENDED,
      canceledCount: counts.CANCELED,
      expiredCount: counts.EXPIRED,
      manualReviewCount: counts.MANUAL_REVIEW,
      paymentsThisMonthCount: paymentsRes.data?.length ?? 0,
      paymentsThisMonthAmount,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      webhooksErrorCount: webhooksRes.count ?? 0,
      trialsEndingSoon: (trialsRes.data ?? []).map((r: any) => ({
        subscription_id: r.id,
        company_id: r.company_id,
        company_name: r.companies?.trade_name ?? r.companies?.corporate_name ?? null,
        plan_name: r.plans?.name ?? null,
        trial_ends_at: r.trial_ends_at,
      })),
    };
  });
