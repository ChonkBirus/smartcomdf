// C1-B: Upgrade / Downgrade orchestration for company subscriptions.
//
// Upgrade  → returns { requires_checkout: true }. The UI opens CheckoutDialog,
//            and the existing billing webhook activates the new plan on payment.
// Downgrade → scheduled to the end of the current period. Validates that
//             current usage fits in the new plan's limits.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlanSlugSchema = z.enum(["starter", "pro", "business"]);
const CycleSchema = z.enum(["MONTHLY", "YEARLY"]);

export type PendingPlanChange = {
  pending_plan_id: string;
  pending_plan_slug: string;
  pending_plan_name: string;
  pending_plan_billing_cycle: "MONTHLY" | "YEARLY" | null;
  pending_plan_change_at: string | null;
  pending_plan_change_type: "UPGRADE" | "DOWNGRADE";
  pending_plan_requested_at: string | null;
} | null;

export type RequestPlanChangeResult =
  | {
      kind: "UPGRADE";
      requires_checkout: true;
      plan_slug: "starter" | "pro" | "business";
      billing_cycle: "MONTHLY" | "YEARLY";
    }
  | {
      kind: "DOWNGRADE";
      requires_checkout: false;
      scheduled_at: string;
      plan_slug: "starter" | "pro" | "business";
      billing_cycle: "MONTHLY" | "YEARLY";
    }
  | {
      kind: "NOOP";
      requires_checkout: false;
      reason: string;
    };

async function getCompanyId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

export const getPendingPlanChange = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingPlanChange> => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) return null;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "pending_plan_id, pending_plan_billing_cycle, pending_plan_change_at, pending_plan_change_type, pending_plan_requested_at, plans!subscriptions_pending_plan_id_fkey(slug, name)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.pending_plan_id) return null;
    return {
      pending_plan_id: sub.pending_plan_id,
      pending_plan_slug: (sub as any).plans?.slug ?? "",
      pending_plan_name: (sub as any).plans?.name ?? "",
      pending_plan_billing_cycle: sub.pending_plan_billing_cycle as any,
      pending_plan_change_at: sub.pending_plan_change_at,
      pending_plan_change_type: sub.pending_plan_change_type as any,
      pending_plan_requested_at: sub.pending_plan_requested_at,
    };
  });

export const requestPlanChangeV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan_slug: PlanSlugSchema,
        billing_cycle: CycleSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RequestPlanChangeResult> => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) throw new Error("Empresa não encontrada.");

    const { data: canChange } = await supabase.rpc("has_permission", {
      _slug: "billing.change_plan",
    });
    if (canChange === false)
      throw new Error("Sem permissão para alterar o plano.");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "id, plan_id, billing_cycle, current_period_end, status, plans(slug, sort_order)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new Error("Assinatura não encontrada.");

    const { data: target } = await supabase
      .from("plans")
      .select("id, slug, name, sort_order")
      .eq("slug", data.plan_slug)
      .eq("active", true)
      .maybeSingle();
    if (!target) throw new Error("Plano de destino não encontrado.");

    const currentSlug = (sub as any).plans?.slug;
    const currentSort = Number((sub as any).plans?.sort_order ?? 0);
    const targetSort = Number(target.sort_order ?? 0);

    if (target.id === sub.plan_id && data.billing_cycle === sub.billing_cycle) {
      return {
        kind: "NOOP",
        requires_checkout: false,
        reason: "Já é o plano e ciclo atuais.",
      };
    }

    const kind: "UPGRADE" | "DOWNGRADE" =
      targetSort > currentSort ? "UPGRADE" : "DOWNGRADE";

    if (kind === "UPGRADE") {
      // Frontend opens CheckoutDialog; webhook will activate new plan on payment.
      await supabase.from("subscription_events").insert({
        company_id: companyId,
        subscription_id: sub.id,
        event_type: "UPGRADE_REQUESTED",
        old_plan_id: sub.plan_id,
        new_plan_id: target.id,
        metadata: {
          billing_cycle: data.billing_cycle,
          from_slug: currentSlug,
          to_slug: target.slug,
        },
        created_by: userId,
      } as any);
      await supabase.rpc("log_audit", {
        _module: "billing",
        _action: "upgrade_requested",
        _new_data: { plan_slug: data.plan_slug, billing_cycle: data.billing_cycle },
      });
      return {
        kind: "UPGRADE",
        requires_checkout: true,
        plan_slug: data.plan_slug,
        billing_cycle: data.billing_cycle,
      };
    }

    // DOWNGRADE — validate current usage vs target plan limits
    const { data: limits } = await supabase
      .from("plan_limits")
      .select(
        "max_users, storage_gb, monthly_ocr_limit, monthly_import_limit, monthly_service_order_limit",
      )
      .eq("plan_id", target.id)
      .maybeSingle();

    if (limits) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const iso = monthStart.toISOString();

      const [usersRes, ocrRes, impRes, osRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("nota_documents")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", iso),
        supabase
          .from("product_import_jobs")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", iso),
        supabase
          .from("service_orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", iso),
      ]);
      const breaches: string[] = [];
      if (limits.max_users != null && (usersRes.count ?? 0) > limits.max_users)
        breaches.push(`usuários (${usersRes.count}/${limits.max_users})`);
      if (
        limits.monthly_ocr_limit != null &&
        (ocrRes.count ?? 0) > limits.monthly_ocr_limit
      )
        breaches.push(
          `OCR no mês (${ocrRes.count}/${limits.monthly_ocr_limit})`,
        );
      if (
        limits.monthly_import_limit != null &&
        (impRes.count ?? 0) > limits.monthly_import_limit
      )
        breaches.push(
          `importações no mês (${impRes.count}/${limits.monthly_import_limit})`,
        );
      if (
        limits.monthly_service_order_limit != null &&
        (osRes.count ?? 0) > limits.monthly_service_order_limit
      )
        breaches.push(
          `OSs no mês (${osRes.count}/${limits.monthly_service_order_limit})`,
        );
      if (breaches.length) {
        throw new Error(
          "Uso atual excede os limites do plano de destino: " +
            breaches.join(", ") +
            ". Reduza o uso antes de fazer o downgrade.",
        );
      }
    }

    const effectiveAt = sub.current_period_end
      ? new Date(sub.current_period_end)
      : (() => {
          const d = new Date();
          d.setMonth(d.getMonth() + 1);
          return d;
        })();

    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({
        pending_plan_id: target.id,
        pending_plan_billing_cycle: data.billing_cycle,
        pending_plan_change_at: effectiveAt.toISOString(),
        pending_plan_change_type: "DOWNGRADE",
        pending_plan_requested_at: new Date().toISOString(),
        pending_plan_requested_by: userId,
      } as any)
      .eq("id", sub.id);
    if (updErr) throw new Error(updErr.message);

    await supabase.from("subscription_events").insert({
      company_id: companyId,
      subscription_id: sub.id,
      event_type: "DOWNGRADE_SCHEDULED",
      old_plan_id: sub.plan_id,
      new_plan_id: target.id,
      metadata: {
        billing_cycle: data.billing_cycle,
        from_slug: currentSlug,
        to_slug: target.slug,
        effective_at: effectiveAt.toISOString(),
      },
      created_by: userId,
    } as any);
    await supabase.rpc("log_audit", {
      _module: "billing",
      _action: "downgrade_scheduled",
      _new_data: {
        plan_slug: data.plan_slug,
        billing_cycle: data.billing_cycle,
        effective_at: effectiveAt.toISOString(),
      },
    });

    return {
      kind: "DOWNGRADE",
      requires_checkout: false,
      scheduled_at: effectiveAt.toISOString(),
      plan_slug: data.plan_slug,
      billing_cycle: data.billing_cycle,
    };
  });

export const cancelPendingPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) throw new Error("Empresa não encontrada.");

    const { data: canChange } = await supabase.rpc("has_permission", {
      _slug: "billing.change_plan",
    });
    if (canChange === false)
      throw new Error("Sem permissão para alterar o plano.");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, pending_plan_id, pending_plan_change_type")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.pending_plan_id)
      return { ok: true, message: "Nenhuma alteração pendente." };

    await supabase
      .from("subscriptions")
      .update({
        pending_plan_id: null,
        pending_plan_billing_cycle: null,
        pending_plan_change_at: null,
        pending_plan_change_type: null,
        pending_plan_requested_at: null,
        pending_plan_requested_by: null,
      } as any)
      .eq("id", sub.id);

    await supabase.from("subscription_events").insert({
      company_id: companyId,
      subscription_id: sub.id,
      event_type:
        sub.pending_plan_change_type === "UPGRADE"
          ? "UPGRADE_CANCELED"
          : "DOWNGRADE_CANCELED",
      metadata: {},
      created_by: userId,
    } as any);
    await supabase.rpc("log_audit", {
      _module: "billing",
      _action: "plan_change_canceled",
      _new_data: {},
    });

    return { ok: true };
  });
