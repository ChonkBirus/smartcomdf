// Coupon validation + admin CRUD for SaaS billing.
// validateCoupon: any authenticated user during checkout.
// All admin fns: super_admin only, via supabaseAdmin.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Acesso restrito a Super Admins.");
}

export type ValidatedCoupon = {
  coupon_id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  duration: "once" | "repeating" | "forever";
  duration_months: number | null;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
};

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z.string().min(1).max(64),
        plan_id: z.string().uuid(),
        amount: z.number().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ValidatedCoupon> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("Empresa não encontrada.");

    const code = data.code.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: coupon, error } = await supabaseAdmin
      .from("billing_coupons")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!coupon) throw new Error("Cupom inválido ou inativo.");

    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now)
      throw new Error("Cupom ainda não está disponível.");
    if (coupon.valid_until && new Date(coupon.valid_until) < now)
      throw new Error("Cupom expirado.");

    if (
      Array.isArray(coupon.eligible_plan_ids) &&
      coupon.eligible_plan_ids.length > 0 &&
      !coupon.eligible_plan_ids.includes(data.plan_id)
    ) {
      throw new Error("Cupom não é válido para este plano.");
    }

    if (
      coupon.max_redemptions != null &&
      coupon.redemption_count >= coupon.max_redemptions
    ) {
      throw new Error("Cupom esgotado.");
    }

    if (coupon.max_redemptions_per_company != null) {
      const { count } = await supabase
        .from("billing_coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("company_id", companyId);
      if ((count ?? 0) >= coupon.max_redemptions_per_company) {
        throw new Error("Sua empresa já utilizou este cupom.");
      }
    }

    const original = round2(data.amount);
    const discount =
      coupon.discount_type === "percent"
        ? round2((original * Number(coupon.discount_value)) / 100)
        : Math.min(round2(Number(coupon.discount_value)), original);
    const final = Math.max(round2(original - discount), 0);

    return {
      coupon_id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type as "percent" | "fixed",
      discount_value: Number(coupon.discount_value),
      duration: coupon.duration as "once" | "repeating" | "forever",
      duration_months: coupon.duration_months,
      original_amount: original,
      discount_amount: discount,
      final_amount: final,
    };
  });

// ============ Admin CRUD ============

const couponInputSchema = z.object({
  code: z.string().min(2).max(64),
  description: z.string().nullable().optional(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().positive(),
  duration: z.enum(["once", "repeating", "forever"]),
  duration_months: z.number().int().positive().nullable().optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  max_redemptions_per_company: z.number().int().positive().nullable().optional(),
  eligible_plan_ids: z.array(z.string().uuid()).nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("billing_coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => couponInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const payload = {
      ...data,
      code: data.code.trim().toUpperCase(),
      is_active: data.is_active ?? true,
      created_by: context.userId,
    };
    const { data: row, error } = await supabaseAdmin
      .from("billing_coupons")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminUpdateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid() })
      .merge(couponInputSchema.partial())
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const payload: any = { ...rest };
    if (payload.code) payload.code = payload.code.trim().toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("billing_coupons")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminToggleCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("billing_coupons")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListCouponRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ coupon_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: rows, error } = await supabaseAdmin
      .from("billing_coupon_redemptions")
      .select(
        "id, company_id, original_amount, discount_amount, final_amount, created_at, companies:company_id(corporate_name, trade_name)",
      )
      .eq("coupon_id", data.coupon_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      company_name:
        r.companies?.trade_name ?? r.companies?.corporate_name ?? null,
    }));
  });
