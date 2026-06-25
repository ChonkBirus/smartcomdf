// Super-admin server functions for billing charges and webhook events.
// All reads/writes go through supabaseAdmin after verifying super_admin role.

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

const listChargesSchema = z.object({
  status: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(200).optional().nullable(),
});

export const adminListBillingCharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listChargesSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    let q = supabaseAdmin
      .from("billing_charges")
      .select(
        "id, company_id, subscription_id, plan_id, provider, provider_charge_id, status, amount, billing_cycle, payment_method, due_date, paid_at, invoice_url, bank_slip_url, created_at, updated_at, companies:company_id(corporate_name, trade_name), plans:plan_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.status) q = q.eq("status", data.status);
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.search)
      q = q.or(
        `provider_charge_id.ilike.%${data.search}%,id.eq.${/^[0-9a-f-]{36}$/i.test(data.search) ? data.search : "00000000-0000-0000-0000-000000000000"}`,
      );

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      company_name:
        r.companies?.trade_name ?? r.companies?.corporate_name ?? null,
      plan_name: r.plans?.name ?? null,
    }));
  });

export const adminListWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.string().optional().nullable(),
        provider: z.string().optional().nullable(),
        limit: z.number().int().min(1).max(200).optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    let q = supabaseAdmin
      .from("billing_webhook_events")
      .select(
        "id, provider, event_id, event_type, provider_object_id, status, processed_at, error_message, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);
    if (data.provider) q = q.eq("provider", data.provider);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetWebhookEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error } = await supabaseAdmin
      .from("billing_webhook_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

// Re-process a previously stored webhook event (idempotent).
export const adminRetryWebhookEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { applyChargeStatus } = await import("@/lib/billing-webhook.server");

    const { data: ev, error } = await supabaseAdmin
      .from("billing_webhook_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ev) throw new Error("Evento não encontrado.");

    const payload = (ev.payload ?? {}) as any;
    const payment = payload.payment ?? payload;
    const providerChargeId =
      ev.provider_object_id ?? payment?.id ?? null;
    if (!providerChargeId)
      throw new Error("Evento sem identificador de cobrança.");

    try {
      await applyChargeStatus(supabaseAdmin, {
        providerChargeId,
        status: payment?.status ?? "UNKNOWN",
        paidAt: payment?.paymentDate ?? null,
        raw: payment ?? null,
      });
      await supabaseAdmin
        .from("billing_webhook_events")
        .update({
          status: "PROCESSED",
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", ev.id);
      return { ok: true };
    } catch (e: any) {
      await supabaseAdmin
        .from("billing_webhook_events")
        .update({
          status: "ERROR",
          error_message: e?.message ?? "Falha ao reprocessar",
        })
        .eq("id", ev.id);
      throw e;
    }
  });

// Sync a charge by id (admin variant — does not require billing.sync_status perm).
export const adminSyncCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ charge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const asaas = await import("@/lib/asaas.server");
    const { applyChargeStatus } = await import("@/lib/billing-webhook.server");

    const { data: charge } = await supabaseAdmin
      .from("billing_charges")
      .select("id, provider, provider_charge_id")
      .eq("id", data.charge_id)
      .maybeSingle();
    if (!charge?.provider_charge_id)
      throw new Error("Cobrança não encontrada.");
    if (charge.provider !== "ASAAS")
      throw new Error("Provider não suportado para sync.");

    const payment = await asaas.asaasGetPayment(charge.provider_charge_id);
    await applyChargeStatus(supabaseAdmin, {
      providerChargeId: payment.id,
      status: payment.status,
      paidAt: (payment as any).paymentDate ?? null,
      raw: payment as any,
    });
    return { ok: true, status: payment.status };
  });

// Charge detail (with raw_payload) + related webhook events for this provider charge.
export const adminGetCharge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: charge, error } = await supabaseAdmin
      .from("billing_charges")
      .select(
        "*, companies:company_id(corporate_name, trade_name), plans:plan_id(name)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!charge) throw new Error("Cobrança não encontrada.");

    let events: any[] = [];
    if (charge.provider_charge_id) {
      const { data: evs } = await supabaseAdmin
        .from("billing_webhook_events")
        .select(
          "id, provider, event_id, event_type, status, processed_at, error_message, created_at",
        )
        .eq("provider_object_id", charge.provider_charge_id)
        .order("created_at", { ascending: false })
        .limit(50);
      events = evs ?? [];
    }
    return {
      ...charge,
      company_name:
        (charge as any).companies?.trade_name ??
        (charge as any).companies?.corporate_name ??
        null,
      plan_name: (charge as any).plans?.name ?? null,
      events,
    };
  });

// Global subscription events feed (across all companies).
export const adminListSubscriptionEventsGlobal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        event_type: z.string().optional().nullable(),
        company_id: z.string().uuid().optional().nullable(),
        limit: z.number().int().min(1).max(500).optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    let q = supabaseAdmin
      .from("subscription_events")
      .select(
        "id, company_id, subscription_id, event_type, previous_status, new_status, previous_plan_id, new_plan_id, description, metadata, created_by, created_at, companies:company_id(corporate_name, trade_name)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.event_type) q = q.eq("event_type", data.event_type);
    if (data.company_id) q = q.eq("company_id", data.company_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      company_name:
        r.companies?.trade_name ?? r.companies?.corporate_name ?? null,
    }));
  });
