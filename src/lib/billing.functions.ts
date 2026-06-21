import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanWithFeatures = {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  max_storage_gb: number;
  features: { code: string; name: string; enabled: boolean }[];
};

export const listPlansWithFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanWithFeatures[]> => {
    const { supabase } = context;
    const { data: plans } = await supabase
      .from("plans")
      .select("id, slug, name, monthly_price, annual_price, max_users, max_storage_gb")
      .eq("active", true)
      .order("monthly_price", { ascending: true });

    const { data: features } = await supabase
      .from("features")
      .select("id, code, name")
      .eq("active", true)
      .order("code");

    const { data: pf } = await supabase.from("plan_features").select("plan_id, feature_id, enabled");

    return (plans ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      monthly_price: Number(p.monthly_price),
      annual_price: Number(p.annual_price),
      max_users: p.max_users,
      max_storage_gb: p.max_storage_gb,
      features: (features ?? []).map((f) => {
        const row = (pf ?? []).find((x) => x.plan_id === p.id && x.feature_id === f.id);
        return { code: f.code, name: f.name, enabled: !!row?.enabled };
      }),
    }));
  });

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
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("Empresa não encontrada.");

    await supabase.rpc("log_activity", {
      _description: `Upgrade solicitado para o plano ${data.plan_slug}${
        data.feature_code ? ` (gatilho: ${data.feature_code})` : ""
      }`,
    });

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) return { users: 0 };

    const { count: users } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    return { users: users ?? 0 };
  });
