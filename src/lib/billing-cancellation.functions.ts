// C1-C: Cancelamento e reativação de assinatura.
//
// scheduleCancellation     → marca cancel_at_period_end=true e agenda para current_period_end.
// revertScheduledCancellation → desfaz o cancelamento agendado enquanto ainda não foi aplicado.
// reactivateSubscription   → para assinaturas CANCELED/EXPIRED: limpa flags e devolve
//                            { requires_checkout: true } para abrir o CheckoutDialog existente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getCompanyId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

async function getActiveSubscription(supabase: any, companyId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, plan_id, status, billing_cycle, current_period_end, cancel_at_period_end, cancellation_effective_at, cancellation_reason, cancellation_scheduled_at, plans(slug, name)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export type ScheduledCancellation = {
  cancel_at_period_end: boolean;
  cancellation_effective_at: string | null;
  cancellation_reason: string | null;
  cancellation_scheduled_at: string | null;
} | null;

export const getScheduledCancellation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScheduledCancellation> => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) return null;
    const sub = await getActiveSubscription(supabase, companyId);
    if (!sub?.cancel_at_period_end) return null;
    return {
      cancel_at_period_end: true,
      cancellation_effective_at: sub.cancellation_effective_at,
      cancellation_reason: sub.cancellation_reason,
      cancellation_scheduled_at: sub.cancellation_scheduled_at,
    };
  });

export const scheduleCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        reason: z.string().trim().max(2000).optional(),
        immediate: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) throw new Error("Empresa não encontrada.");

    const { data: canCancel } = await supabase.rpc("has_permission", {
      _slug: "billing.cancel_subscription",
    });
    if (canCancel === false) throw new Error("Sem permissão para cancelar a assinatura.");

    const sub = await getActiveSubscription(supabase, companyId);
    if (!sub) throw new Error("Assinatura não encontrada.");
    if (["CANCELED", "EXPIRED"].includes(sub.status))
      throw new Error("Assinatura já está cancelada.");

    const effectiveAt =
      data.immediate || !sub.current_period_end ? new Date() : new Date(sub.current_period_end);
    const now = new Date().toISOString();

    if (data.immediate) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "CANCELED",
          active: false,
          canceled_at: now,
          canceled_by: userId,
          cancel_at_period_end: false,
          cancellation_scheduled_at: now,
          cancellation_effective_at: now,
          cancellation_reason: data.reason ?? null,
        } as any)
        .eq("id", sub.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          cancellation_scheduled_at: now,
          cancellation_effective_at: effectiveAt.toISOString(),
          cancellation_reason: data.reason ?? null,
          canceled_by: userId,
        } as any)
        .eq("id", sub.id);
      if (error) throw new Error(error.message);
    }

    await supabase.from("subscription_events").insert({
      company_id: companyId,
      subscription_id: sub.id,
      event_type: data.immediate ? "CANCELLATION_APPLIED" : "CANCELLATION_SCHEDULED",
      old_plan_id: sub.plan_id,
      new_plan_id: sub.plan_id,
      metadata: {
        reason: data.reason ?? null,
        effective_at: effectiveAt.toISOString(),
        immediate: !!data.immediate,
      },
      created_by: userId,
    } as any);
    await supabase.rpc("log_audit", {
      _module: "billing",
      _action: data.immediate ? "cancel_immediate" : "cancel_scheduled",
      _new_data: {
        effective_at: effectiveAt.toISOString(),
        reason: data.reason ?? null,
      },
    });

    return {
      ok: true,
      immediate: !!data.immediate,
      effective_at: effectiveAt.toISOString(),
    };
  });

export const revertScheduledCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) throw new Error("Empresa não encontrada.");

    const { data: canCancel } = await supabase.rpc("has_permission", {
      _slug: "billing.cancel_subscription",
    });
    if (canCancel === false) throw new Error("Sem permissão para alterar a assinatura.");

    const sub = await getActiveSubscription(supabase, companyId);
    if (!sub) throw new Error("Assinatura não encontrada.");
    if (!sub.cancel_at_period_end) throw new Error("Não há cancelamento agendado.");

    const { error } = await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        cancellation_scheduled_at: null,
        cancellation_effective_at: null,
        cancellation_reason: null,
        canceled_by: null,
      } as any)
      .eq("id", sub.id);
    if (error) throw new Error(error.message);

    await supabase.from("subscription_events").insert({
      company_id: companyId,
      subscription_id: sub.id,
      event_type: "CANCELLATION_REVERTED",
      old_plan_id: sub.plan_id,
      new_plan_id: sub.plan_id,
      metadata: {},
      created_by: userId,
    } as any);
    await supabase.rpc("log_audit", {
      _module: "billing",
      _action: "cancel_reverted",
      _new_data: {},
    });
    return { ok: true };
  });

export type ReactivateResult =
  | { kind: "REQUIRES_CHECKOUT"; plan_slug: string; billing_cycle: "MONTHLY" | "YEARLY" }
  | { kind: "REACTIVATED" };

export const reactivateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReactivateResult> => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) throw new Error("Empresa não encontrada.");

    const { data: canCheckout } = await supabase.rpc("has_permission", {
      _slug: "billing.checkout",
    });
    if (canCheckout === false) throw new Error("Sem permissão para reativar a assinatura.");

    const sub = await getActiveSubscription(supabase, companyId);
    if (!sub) throw new Error("Assinatura não encontrada.");

    // Cancelamento ainda não efetivado → apenas reverter
    if (sub.cancel_at_period_end && !["CANCELED", "EXPIRED"].includes(sub.status)) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
          cancellation_scheduled_at: null,
          cancellation_effective_at: null,
          cancellation_reason: null,
          canceled_by: null,
        } as any)
        .eq("id", sub.id);
      if (error) throw new Error(error.message);

      await supabase.from("subscription_events").insert({
        company_id: companyId,
        subscription_id: sub.id,
        event_type: "CANCELLATION_REVERTED",
        old_plan_id: sub.plan_id,
        new_plan_id: sub.plan_id,
        metadata: { via: "reactivate" },
        created_by: userId,
      } as any);
      return { kind: "REACTIVATED" };
    }

    if (!["CANCELED", "EXPIRED"].includes(sub.status))
      throw new Error("Assinatura não está cancelada.");

    await supabase.rpc("log_audit", {
      _module: "billing",
      _action: "reactivate_requested",
      _new_data: { plan_slug: (sub as any).plans?.slug },
    });

    return {
      kind: "REQUIRES_CHECKOUT",
      plan_slug: (sub as any).plans?.slug ?? "pro",
      billing_cycle: (sub.billing_cycle as "MONTHLY" | "YEARLY") ?? "MONTHLY",
    };
  });
