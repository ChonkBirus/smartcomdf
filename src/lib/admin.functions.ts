import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Acesso restrito a Super Admins.");
}

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("admin_companies_overview");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const setStatusSchema = z.object({
  company_id: z.string().uuid(),
  status: z.enum(["trial", "active", "inactive", "blocked"]),
});

export const setCompanyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => setStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("admin_set_company_status", {
      _company_id: data.company_id,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("plans")
      .select("*")
      .order("monthly_price", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const listSubsSchema = z.object({
  status: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
});

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listSubsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_list_subscriptions", {
      _status: data.status || null,
      _search: data.search || null,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const updateSubSchema = z.object({
  subscription_id: z.string().uuid(),
  new_plan_id: z.string().uuid().optional().nullable(),
  new_status: z.enum(["TRIALING","ACTIVE","PAST_DUE","SUSPENDED","CANCELED","EXPIRED","MANUAL_REVIEW"]).optional().nullable(),
  new_billing_cycle: z.enum(["MONTHLY","YEARLY"]).optional().nullable(),
  extend_trial_days: z.number().int().optional().nullable(),
  extend_grace_days: z.number().int().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const updateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSubSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("admin_update_subscription", {
      _subscription_id: data.subscription_id,
      _new_plan_id: data.new_plan_id ?? null,
      _new_status: data.new_status ?? null,
      _new_billing_cycle: data.new_billing_cycle ?? null,
      _extend_trial_days: data.extend_trial_days ?? null,
      _extend_grace_days: data.extend_grace_days ?? null,
      _description: data.description ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSubscriptionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subscription_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_list_subscription_events", {
      _subscription_id: data.subscription_id,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
