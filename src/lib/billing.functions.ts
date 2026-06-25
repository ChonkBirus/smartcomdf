import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanWithFeatures = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  max_storage_gb: number;
  features: { code: string; name: string; enabled: boolean }[];
  limits: PlanLimits | null;
};

export type PlanLimits = {
  max_users: number | null;
  max_companies: number | null;
  storage_gb: number | null;
  monthly_ocr_limit: number | null;
  monthly_import_limit: number | null;
  monthly_service_order_limit: number | null;
};

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELED"
  | "EXPIRED"
  | "MANUAL_REVIEW";

export type CurrentSubscription = {
  id: string;
  company_id: string;
  plan_id: string;
  plan_slug: string;
  plan_name: string;
  status: SubscriptionStatus;
  billing_cycle: "MONTHLY" | "YEARLY";
  monthly_price: number;
  yearly_price: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  next_billing_date: string | null;
  canceled_at: string | null;
  suspended_at: string | null;
  activated_at: string | null;
  limits: PlanLimits | null;
};

export type SubscriptionUsage = {
  users_count: number;
  storage_used_mb: number;
  ocr_used_count: number;
  imports_used_count: number;
  service_orders_count: number;
};

export type CompanyCharge = {
  id: string;
  provider: string;
  status: string;
  payment_method: string | null;
  billing_cycle: "MONTHLY" | "YEARLY";
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_copy_paste: string | null;
  checkout_url: string | null;
  created_at: string;
};

async function getCompanyId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.company_id ?? null;
}

export const listPlansWithFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanWithFeatures[]> => {
    const { supabase } = context;
    const { data: plans } = await supabase
      .from("plans")
      .select(
        "id, slug, name, description, sort_order, monthly_price, annual_price, max_users, max_storage_gb",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("monthly_price", { ascending: true });

    const { data: features } = await supabase
      .from("features")
      .select("id, code, name")
      .eq("active", true)
      .order("code");

    const { data: pf } = await supabase
      .from("plan_features")
      .select("plan_id, feature_id, enabled");

    const { data: limits } = await supabase
      .from("plan_limits")
      .select(
        "plan_id, max_users, max_companies, storage_gb, monthly_ocr_limit, monthly_import_limit, monthly_service_order_limit",
      );

    return (plans ?? []).map((p: any) => {
      const lim = (limits ?? []).find((l: any) => l.plan_id === p.id);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description ?? null,
        sort_order: p.sort_order ?? 0,
        monthly_price: Number(p.monthly_price),
        annual_price: Number(p.annual_price),
        max_users: p.max_users,
        max_storage_gb: p.max_storage_gb,
        features: (features ?? []).map((f: any) => {
          const row = (pf ?? []).find(
            (x: any) => x.plan_id === p.id && x.feature_id === f.id,
          );
          return { code: f.code, name: f.name, enabled: !!row?.enabled };
        }),
        limits: lim
          ? {
              max_users: lim.max_users,
              max_companies: lim.max_companies,
              storage_gb: lim.storage_gb,
              monthly_ocr_limit: lim.monthly_ocr_limit,
              monthly_import_limit: lim.monthly_import_limit,
              monthly_service_order_limit: lim.monthly_service_order_limit,
            }
          : null,
      };
    });
  });

export const getCurrentCompanySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentSubscription | null> => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) return null;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "id, company_id, plan_id, status, billing_cycle, monthly_price, yearly_price, current_period_start, current_period_end, trial_starts_at, trial_ends_at, grace_period_ends_at, next_billing_date, canceled_at, suspended_at, activated_at, plans(slug, name)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return null;

    const { data: lim } = await supabase
      .from("plan_limits")
      .select(
        "max_users, max_companies, storage_gb, monthly_ocr_limit, monthly_import_limit, monthly_service_order_limit",
      )
      .eq("plan_id", sub.plan_id)
      .maybeSingle();

    return {
      id: sub.id,
      company_id: sub.company_id,
      plan_id: sub.plan_id,
      plan_slug: (sub as any).plans?.slug ?? "",
      plan_name: (sub as any).plans?.name ?? "",
      status: sub.status as SubscriptionStatus,
      billing_cycle: sub.billing_cycle as "MONTHLY" | "YEARLY",
      monthly_price: Number(sub.monthly_price ?? 0),
      yearly_price: sub.yearly_price !== null ? Number(sub.yearly_price) : null,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      trial_starts_at: sub.trial_starts_at,
      trial_ends_at: sub.trial_ends_at,
      grace_period_ends_at: sub.grace_period_ends_at,
      next_billing_date: sub.next_billing_date,
      canceled_at: sub.canceled_at,
      suspended_at: sub.suspended_at,
      activated_at: sub.activated_at,
      limits: lim ?? null,
    };
  });

export const getCompanySubscriptionUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionUsage> => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const empty: SubscriptionUsage = {
      users_count: 0,
      storage_used_mb: 0,
      ocr_used_count: 0,
      imports_used_count: 0,
      service_orders_count: 0,
    };
    if (!companyId) return empty;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const [usersRes, ocrRes, importsRes, osRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
      supabase
        .from("nota_documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", monthStartIso),
      supabase
        .from("product_import_jobs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", monthStartIso),
      supabase
        .from("service_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", monthStartIso),
    ]);

    return {
      users_count: usersRes.count ?? 0,
      storage_used_mb: 0,
      ocr_used_count: ocrRes.count ?? 0,
      imports_used_count: importsRes.count ?? 0,
      service_orders_count: osRes.count ?? 0,
    };
  });

export const requestPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan_slug: z.enum(["starter", "pro", "business"]),
        billing_cycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) throw new Error("Empresa não encontrada.");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: plan } = await supabase
      .from("plans")
      .select("id, name")
      .eq("slug", data.plan_slug)
      .maybeSingle();

    if (sub && plan) {
      await supabase.from("subscription_events").insert({
        company_id: companyId,
        subscription_id: sub.id,
        event_type: "MANUAL_ADJUSTMENT",
        new_plan_id: plan.id,
        description: `Solicitação de alteração para o plano ${plan.name}${
          data.billing_cycle ? ` (${data.billing_cycle})` : ""
        }`,
        created_by: userId,
      });
    }

    await supabase.rpc("log_audit", {
      _module: "billing",
      _action: "plan_change_requested",
      _new_data: { plan_slug: data.plan_slug, billing_cycle: data.billing_cycle ?? null },
    });

    return { ok: true };
  });

// Backwards compatible alias (used by older code paths)
export const requestPlanUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan_slug: z.enum(["starter", "pro", "business"]),
        feature_code: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.rpc("log_audit", {
      _module: "billing",
      _action: "upgrade_requested",
      _new_data: { plan_slug: data.plan_slug, feature_code: data.feature_code ?? null },
    });
    return { ok: true };
  });

export const logFeatureBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ feature_code: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.rpc("log_audit", {
      _module: "billing",
      _action: "feature_blocked",
      _new_data: { feature_code: data.feature_code },
    });
    return { ok: true };
  });

export const getCompanyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) return { users: 0 };
    const { count: users } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    return { users: users ?? 0 };
  });

export const listCompanyCharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyCharge[]> => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) return [];

    const { data, error } = await supabase
      .from("billing_charges")
      .select(
        "id, provider, status, payment_method, billing_cycle, amount, due_date, paid_at, invoice_url, bank_slip_url, pix_copy_paste, checkout_url, created_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return [];
    return (data ?? []).map((r: any) => ({
      ...r,
      amount: Number(r.amount ?? 0),
    }));
  });
