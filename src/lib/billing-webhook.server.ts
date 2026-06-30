// Shared server-only webhook logic.
// Maps Asaas payment statuses to billing_charges + subscriptions transitions.

import type { SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any, "public", any>;

// Asaas payment statuses we care about.
// https://docs.asaas.com/docs/webhook-para-cobrancas
export const ASAAS_PAID_STATUSES = new Set([
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
]);
export const ASAAS_OVERDUE_STATUSES = new Set(["OVERDUE"]);
export const ASAAS_REFUSED_STATUSES = new Set([
  "CREDIT_CARD_CAPTURE_REFUSED",
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
]);
export const ASAAS_CANCELED_STATUSES = new Set([
  "REFUNDED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "REFUND_REQUESTED",
  "DELETED",
]);

export type ApplyChargeInput = {
  providerChargeId: string;
  status: string;
  paidAt?: string | null;
  raw?: Record<string, unknown> | null;
};

export async function applyChargeStatus(
  admin: AnyClient,
  input: ApplyChargeInput,
) {
  const { data: charge } = await admin
    .from("billing_charges")
    .select(
      "id, company_id, subscription_id, plan_id, amount, billing_cycle, status",
    )
    .eq("provider_charge_id", input.providerChargeId)
    .eq("provider", "ASAAS")
    .maybeSingle();
  if (!charge) {
    console.warn("[billing-webhook] charge not found", input.providerChargeId);
    return { matched: false };
  }

  await admin
    .from("billing_charges")
    .update({
      status: input.status,
      paid_at: input.paidAt ?? null,
      raw_payload: (input.raw ?? null) as any,
    })
    .eq("id", charge.id);

  // Resolve target subscription (the charge's subscription, or the latest for the company)
  let subscriptionId = charge.subscription_id;
  if (!subscriptionId) {
    const { data: latest } = await admin
      .from("subscriptions")
      .select("id")
      .eq("company_id", charge.company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    subscriptionId = latest?.id ?? null;
  }

  if (!subscriptionId) return { matched: true, subscription: false };

  if (ASAAS_PAID_STATUSES.has(input.status)) {
    const now = new Date();
    const periodEnd = new Date(now);
    if (charge.billing_cycle === "YEARLY") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await admin
      .from("subscriptions")
      .update({
        status: "ACTIVE",
        active: true,
        trial: false,
        activated_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_billing_date: periodEnd.toISOString().slice(0, 10),
        grace_period_ends_at: null,
        suspended_at: null,
        canceled_at: null,
        plan_id: charge.plan_id ?? undefined,
        billing_cycle: charge.billing_cycle,
        payment_provider: "ASAAS",
      })
      .eq("id", subscriptionId);

    await insertSubscriptionEvent(admin, {
      subscription_id: subscriptionId,
      company_id: charge.company_id,
      event_type: "PAYMENT_CONFIRMED",
      from_status: null,
      to_status: "ACTIVE",
      metadata: { charge_id: charge.id, provider_charge_id: input.providerChargeId },
    });
    await insertNotificationForOwners(admin, charge.company_id, {
      title: "Pagamento confirmado",
      message: "Sua assinatura foi ativada com sucesso.",
      type: "BILLING",
    });
  } else if (ASAAS_OVERDUE_STATUSES.has(input.status)) {
    const grace = new Date();
    grace.setDate(grace.getDate() + 5);
    await admin
      .from("subscriptions")
      .update({
        status: "PAST_DUE",
        grace_period_ends_at: grace.toISOString(),
      })
      .eq("id", subscriptionId);

    await insertSubscriptionEvent(admin, {
      subscription_id: subscriptionId,
      company_id: charge.company_id,
      event_type: "PAYMENT_OVERDUE",
      from_status: null,
      to_status: "PAST_DUE",
      metadata: { charge_id: charge.id },
    });
    await insertNotificationForOwners(admin, charge.company_id, {
      title: "Pagamento em atraso",
      message:
        "Identificamos uma cobrança em atraso. Regularize para evitar a suspensão.",
      type: "BILLING",
    });
  } else if (ASAAS_REFUSED_STATUSES.has(input.status)) {
    await insertSubscriptionEvent(admin, {
      subscription_id: subscriptionId,
      company_id: charge.company_id,
      event_type: "PAYMENT_REFUSED",
      from_status: null,
      to_status: null,
      metadata: { charge_id: charge.id, asaas_status: input.status },
    });
    await insertNotificationForOwners(admin, charge.company_id, {
      title: "Pagamento recusado",
      message:
        "O pagamento foi recusado pela operadora. Atualize seus dados de pagamento.",
      type: "BILLING",
    });
  } else if (ASAAS_CANCELED_STATUSES.has(input.status)) {
    await admin
      .from("subscriptions")
      .update({
        status: "CANCELED",
        active: false,
        canceled_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    await insertSubscriptionEvent(admin, {
      subscription_id: subscriptionId,
      company_id: charge.company_id,
      event_type: "PAYMENT_REFUNDED",
      from_status: null,
      to_status: "CANCELED",
      metadata: { charge_id: charge.id, asaas_status: input.status },
    });
  }

  return { matched: true, subscription: true };
}

// Handle SUBSCRIPTION_* events from Asaas (lifecycle updates without a payment object).
export async function applySubscriptionEvent(
  admin: AnyClient,
  input: {
    providerSubscriptionId: string;
    eventType: string;
    raw?: Record<string, unknown> | null;
  },
) {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, company_id, status")
    .eq("provider_subscription_id", input.providerSubscriptionId)
    .maybeSingle();
  if (!sub) {
    console.warn(
      "[billing-webhook] subscription not found",
      input.providerSubscriptionId,
    );
    return { matched: false };
  }

  let patch: Record<string, unknown> | null = null;
  let toStatus: string | null = null;
  if (input.eventType === "SUBSCRIPTION_INACTIVATED") {
    patch = { status: "PAST_DUE", active: false };
    toStatus = "PAST_DUE";
  } else if (input.eventType === "SUBSCRIPTION_DELETED") {
    patch = {
      status: "CANCELED",
      active: false,
      canceled_at: new Date().toISOString(),
    };
    toStatus = "CANCELED";
  }
  if (patch) {
    await admin.from("subscriptions").update(patch).eq("id", sub.id);
  }
  await insertSubscriptionEvent(admin, {
    subscription_id: sub.id,
    company_id: sub.company_id,
    event_type: input.eventType,
    from_status: sub.status ?? null,
    to_status: toStatus,
    metadata: { provider_subscription_id: input.providerSubscriptionId },
  });
  return { matched: true };
}


async function insertSubscriptionEvent(
  admin: AnyClient,
  row: {
    subscription_id: string;
    company_id: string;
    event_type: string;
    from_status: string | null;
    to_status: string | null;
    metadata: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("subscription_events").insert(row as any);
  if (error) console.error("[billing-webhook] subscription_events insert", error);
}

async function insertNotificationForOwners(
  admin: AnyClient,
  companyId: string,
  payload: { title: string; message: string; type: string },
) {
  const { data: owners } = await admin
    .from("profile_roles")
    .select("profile_id, roles!inner(slug)")
    .eq("company_id", companyId);
  const targets = (owners ?? [])
    .filter((r: any) =>
      ["owner", "admin", "finance"].includes(r.roles?.slug ?? ""),
    )
    .map((r: any) => r.profile_id);
  if (!targets.length) return;
  const rows = targets.map((uid) => ({
    user_id: uid,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    read: false,
  }));
  const { error } = await admin.from("notifications").insert(rows as any);
  if (error) console.error("[billing-webhook] notifications insert", error);
}
