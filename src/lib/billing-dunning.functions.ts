// Super-admin dunning engine: list events, run rules, register manual contact.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Acesso restrito a Super Admins.");
}

export type DunningEventRow = {
  id: string;
  company_id: string;
  subscription_id: string;
  billing_charge_id: string | null;
  rule_id: string | null;
  event_code: string;
  status: string;
  due_date: string | null;
  scheduled_for: string | null;
  executed_at: string | null;
  channel: string | null;
  message: string | null;
  notes: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  company_name: string | null;
  company_whatsapp: string | null;
  company_email: string | null;
  rule_name: string | null;
  trigger_type: string | null;
  charge_amount: number | null;
  charge_due_date: string | null;
};

export const listDunningEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { status?: string | null; event_code?: string | null } | undefined) =>
      input ?? {},
  )
  .handler(async ({ data, context }): Promise<DunningEventRow[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    let q = supabaseAdmin
      .from("billing_dunning_events")
      .select(
        `id, company_id, subscription_id, billing_charge_id, rule_id, event_code, status,
         due_date, scheduled_for, executed_at, channel, message, notes, handled_by, handled_at, created_at,
         companies:company_id ( corporate_name, trade_name, whatsapp, email ),
         billing_dunning_rules:rule_id ( name, trigger_type ),
         billing_charges:billing_charge_id ( amount, due_date )`,
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status) q = q.eq("status", data.status);
    if (data.event_code) q = q.eq("event_code", data.event_code);

    const { data: rows, error } = await q;
    if (error) throw error;

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      company_id: r.company_id,
      subscription_id: r.subscription_id,
      billing_charge_id: r.billing_charge_id,
      rule_id: r.rule_id,
      event_code: r.event_code,
      status: r.status,
      due_date: r.due_date,
      scheduled_for: r.scheduled_for,
      executed_at: r.executed_at,
      channel: r.channel,
      message: r.message,
      notes: r.notes,
      handled_by: r.handled_by,
      handled_at: r.handled_at,
      created_at: r.created_at,
      company_name: r.companies?.trade_name ?? r.companies?.corporate_name ?? null,
      company_whatsapp: r.companies?.whatsapp ?? null,
      company_email: r.companies?.email ?? null,
      rule_name: r.billing_dunning_rules?.name ?? null,
      trigger_type: r.billing_dunning_rules?.trigger_type ?? null,
      charge_amount: r.billing_charges?.amount ?? null,
      charge_due_date: r.billing_charges?.due_date ?? null,
    }));
  });

export const processDunningRulesNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin.rpc(
      "process_billing_dunning_rules",
    );
    if (error) throw error;
    return data as Array<{ rule_code: string; inserted_count: number }>;
  });

export const registerDunningContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      event_id: string;
      channel: "WHATSAPP" | "PHONE" | "EMAIL" | "MANUAL" | "INTERNAL";
      result?: string;
      message?: string;
      next_follow_up_at?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: logId, error } = await context.supabase.rpc(
      "register_dunning_contact",
      {
        _event_id: data.event_id,
        _channel: data.channel,
        _result: data.result ?? null,
        _message: data.message ?? null,
        _next_follow_up_at: data.next_follow_up_at ?? null,
      },
    );
    if (error) throw error;
    return { log_id: logId as string };
  });

export const skipDunningEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event_id: string; notes?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("billing_dunning_events")
      .update({
        status: "SKIPPED",
        handled_by: context.userId,
        handled_at: new Date().toISOString(),
        notes: data.notes ?? null,
      })
      .eq("id", data.event_id);
    if (error) throw error;
    return { ok: true };
  });
