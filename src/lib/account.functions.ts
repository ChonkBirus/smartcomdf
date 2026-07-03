import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns current user's profile, company and roles
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*, companies(*, plans(*))")
      .eq("id", userId)
      .maybeSingle();

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userId);

    const { data: permsRpc } = await supabase.rpc("get_my_permissions");
    const permissions: string[] = Array.isArray(permsRpc) ? (permsRpc as string[]) : [];

    const { data: featsRpc } = await supabase.rpc("get_my_features");
    const features: string[] = Array.isArray(featsRpc) ? (featsRpc as string[]) : [];

    let subscription: {
      trial: boolean;
      active: boolean;
      expiration_date: string | null;
      start_date: string;
    } | null = null;
    const companyId = profile?.company_id ?? null;
    if (companyId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("trial, active, expiration_date, start_date")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = sub ?? null;
    }

    const company = profile?.companies ?? null;
    return {
      profile,
      company,
      plan: (company as { plans?: unknown } | null)?.plans ?? null,
      subscription,
      roles: roles ?? [],
      permissions,
      features,
      isSuperAdmin: (roles ?? []).some((r) => r.role === "super_admin"),
      isOwner: (roles ?? []).some((r) => r.role === "owner"),
    };
  });

const createCompanySchema = z.object({
  corporate_name: z.string().trim().min(2).max(150),
  trade_name: z.string().trim().max(150).optional(),
  cnpj: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(20).optional(),
  plan_slug: z.enum(["starter", "pro", "business"]).default("starter"),
  coupon_code: z.string().trim().min(1).max(64).optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export const createCompanyForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createCompanySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Block if user already belongs to a company
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (existing?.company_id) throw new Error("Usuário já vinculado a uma empresa.");

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, monthly_price")
      .eq("slug", data.plan_slug)
      .maybeSingle();
    if (!plan) throw new Error("Plano inválido.");

    // Validate coupon early (before creating anything) so signup errors cleanly
    let appliedCoupon: {
      id: string;
      code: string;
      discount_type: "percent" | "fixed";
      discount_value: number;
    } | null = null;
    if (data.coupon_code) {
      const code = data.coupon_code.trim().toUpperCase();
      const { data: coupon } = await supabaseAdmin
        .from("billing_coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (!coupon) throw new Error("Cupom inválido ou inativo.");
      const now = new Date();
      if (coupon.valid_from && new Date(coupon.valid_from) > now)
        throw new Error("Cupom ainda não está disponível.");
      if (coupon.valid_until && new Date(coupon.valid_until) < now)
        throw new Error("Cupom expirado.");
      if (
        Array.isArray(coupon.eligible_plan_ids) &&
        coupon.eligible_plan_ids.length > 0 &&
        !coupon.eligible_plan_ids.includes(plan.id)
      )
        throw new Error("Cupom não aplicável a este plano.");
      if (
        coupon.max_redemptions != null &&
        coupon.redemption_count >= coupon.max_redemptions
      )
        throw new Error("Cupom esgotado.");
      appliedCoupon = {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type as "percent" | "fixed",
        discount_value: Number(coupon.discount_value),
      };
    }

    const { data: company, error: cErr } = await supabaseAdmin
      .from("companies")
      .insert({
        corporate_name: data.corporate_name,
        trade_name: data.trade_name ?? null,
        cnpj: data.cnpj ?? null,
        phone: data.phone ?? null,
        plan_id: plan.id,
        status: "trial",
      })
      .select()
      .single();
    if (cErr || !company) throw new Error(cErr?.message ?? "Falha ao criar empresa.");

    await supabaseAdmin.from("profiles").update({ company_id: company.id }).eq("id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, company_id: company.id, role: "owner" });
    await supabaseAdmin.from("company_settings").insert({ company_id: company.id });
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        company_id: company.id,
        plan_id: plan.id,
        trial: true,
        expiration_date: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (appliedCoupon && subscription) {
      const original = Number(plan.monthly_price ?? 0);
      const discount =
        appliedCoupon.discount_type === "percent"
          ? round2((original * appliedCoupon.discount_value) / 100)
          : Math.min(round2(appliedCoupon.discount_value), original);
      const final = round2(Math.max(0, original - discount));
      await supabaseAdmin.from("billing_coupon_redemptions").insert({
        company_id: company.id,
        coupon_id: appliedCoupon.id,
        subscription_id: subscription.id,
        original_amount: original,
        discount_amount: discount,
        final_amount: final,
      });
      const { data: current } = await supabaseAdmin
        .from("billing_coupons")
        .select("redemption_count")
        .eq("id", appliedCoupon.id)
        .single();
      await supabaseAdmin
        .from("billing_coupons")
        .update({ redemption_count: (current?.redemption_count ?? 0) + 1 })
        .eq("id", appliedCoupon.id);
    }

    return { company_id: company.id, coupon_applied: appliedCoupon?.code ?? null };
  });

