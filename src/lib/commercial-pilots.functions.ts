// Super-admin commercial pilots management: list/create/update + follow-up logs.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Acesso restrito a Super Admins.");
}

export type CommercialPilotRow = {
  id: string;
  company_id: string;
  status: string;
  onboarding_status: string;
  source: string | null;
  responsible_admin_id: string | null;
  notes: string | null;
  expected_conversion_date: string | null;
  converted_at: string | null;
  lost_at: string | null;
  loss_reason: string | null;
  created_at: string;
  updated_at: string;
  company_name: string | null;
  company_email: string | null;
  company_whatsapp: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  activation_score: number;
  activation_tier: "LOW" | "ACTIVATING" | "GOOD" | "READY";
  last_login: string | null;
  users_count: number;
  counts: {
    customers: number;
    items: number;
    quotes: number;
    pdfs: number;
    sent: number;
    approved: number;
    projects: number;
    service_orders: number;
    service_orders_done: number;
    reports: number;
    users: number;
  };
  checklist: Record<string, boolean>;
};

export type PilotContactLog = {
  id: string;
  contact_type: string | null;
  contact_channel: string | null;
  subject: string | null;
  message: string | null;
  result: string | null;
  contacted_at: string;
  next_follow_up_at: string | null;
};

export const PILOT_STATUSES = [
  "INVITED",
  "ACTIVE_TRIAL",
  "ONBOARDING",
  "USING",
  "READY_TO_CONVERT",
  "CONVERTED",
  "LOST",
  // legacy
  "prospect",
  "active",
  "in_progress",
  "converted",
  "lost",
  "paused",
] as const;

export const ONBOARDING_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "STUCK"] as const;

export const listCommercialPilots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string | null } | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<CommercialPilotRow[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("commercial_pilots")
      .select(
        "id, company_id, status, onboarding_status, source, responsible_admin_id, notes, expected_conversion_date, converted_at, lost_at, loss_reason, created_at, updated_at, companies:company_id(trade_name, corporate_name, email, whatsapp)",
      )
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "ALL") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    const ids = (rows ?? []).map((r: any) => r.company_id);
    const contactsByCompany = new Map<string, { last: string | null; next: string | null }>();
    if (ids.length > 0) {
      const { data: logs } = await supabaseAdmin
        .from("commercial_contact_logs")
        .select("company_id, contacted_at, next_follow_up_at")
        .in("company_id", ids)
        .order("contacted_at", { ascending: false });
      (logs ?? []).forEach((l: any) => {
        const prev = contactsByCompany.get(l.company_id);
        if (!prev) {
          contactsByCompany.set(l.company_id, {
            last: l.contacted_at,
            next: l.next_follow_up_at,
          });
        } else if (l.next_follow_up_at && (!prev.next || l.next_follow_up_at > prev.next)) {
          contactsByCompany.set(l.company_id, { last: prev.last, next: l.next_follow_up_at });
        }
      });
    }
    // Fetch activation metrics per company in parallel
    const activations = await Promise.all(
      (rows ?? []).map(async (r: any) => {
        const { data: act } = await supabaseAdmin.rpc("get_pilot_activation", {
          _company_id: r.company_id,
        });
        return { id: r.id, act: (act as any) ?? {} };
      }),
    );
    const actById = new Map(activations.map((a) => [a.id, a.act]));
    return (rows ?? []).map((r: any) => {
      const c = contactsByCompany.get(r.company_id);
      const act: any = actById.get(r.id) ?? {};
      return {
        ...r,
        company_name: r.companies?.trade_name ?? r.companies?.corporate_name ?? null,
        company_email: r.companies?.email ?? null,
        company_whatsapp: r.companies?.whatsapp ?? null,
        last_contact_at: c?.last ?? null,
        next_follow_up_at: c?.next ?? null,
        activation_score: act.score ?? 0,
        activation_tier: act.tier ?? "LOW",
        last_login: act.last_login ?? null,
        users_count: act.users_count ?? 0,
        counts: act.counts ?? {},
        checklist: act.checklist ?? {},
        companies: undefined,
      };
    }) as CommercialPilotRow[];
  });

export const createCommercialPilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      company_id: string;
      status?: string;
      onboarding_status?: string;
      source?: string | null;
      notes?: string | null;
      expected_conversion_date?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("commercial_pilots").insert({
      company_id: data.company_id,
      status: data.status ?? "INVITED",
      onboarding_status: data.onboarding_status ?? "NOT_STARTED",
      source: data.source ?? null,
      notes: data.notes ?? null,
      expected_conversion_date: data.expected_conversion_date ?? null,
      responsible_admin_id: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const updateCommercialPilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      status?: string;
      onboarding_status?: string;
      source?: string | null;
      notes?: string | null;
      expected_conversion_date?: string | null;
      loss_reason?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "CONVERTED" || data.status === "converted")
        patch.converted_at = new Date().toISOString();
      if (data.status === "LOST" || data.status === "lost")
        patch.lost_at = new Date().toISOString();
    }
    if (data.onboarding_status !== undefined) patch.onboarding_status = data.onboarding_status;
    if (data.source !== undefined) patch.source = data.source;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.expected_conversion_date !== undefined)
      patch.expected_conversion_date = data.expected_conversion_date;
    if (data.loss_reason !== undefined) patch.loss_reason = data.loss_reason;
    const { error } = await supabaseAdmin.from("commercial_pilots").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteCommercialPilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("commercial_pilots").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listPilotContactLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { company_id: string }) => input)
  .handler(async ({ data, context }): Promise<PilotContactLog[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("commercial_contact_logs")
      .select(
        "id, contact_type, contact_channel, subject, message, result, contacted_at, next_follow_up_at",
      )
      .eq("company_id", data.company_id)
      .order("contacted_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (rows ?? []) as PilotContactLog[];
  });

export const addPilotContactLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      company_id: string;
      contact_channel: string;
      subject?: string | null;
      message?: string | null;
      result?: string | null;
      next_follow_up_at?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("commercial_contact_logs").insert({
      company_id: data.company_id,
      contact_type: "PILOT_FOLLOWUP",
      contact_channel: data.contact_channel,
      subject: data.subject ?? null,
      message: data.message ?? null,
      result: data.result ?? null,
      contacted_by: context.userId,
      contacted_at: new Date().toISOString(),
      next_follow_up_at: data.next_follow_up_at ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export type PilotMetrics = {
  total: number;
  active: number;
  inProgress: number;
  converted: number;
  lost: number;
  paused: number;
  conversionRate: number;
  pendingFollowUps: number;
};

export const getCommercialPilotMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PilotMetrics> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pilots } = await supabaseAdmin.from("commercial_pilots").select("status");
    const list = (pilots ?? []) as Array<{ status: string }>;
    const count = (s: string) => list.filter((p) => p.status === s).length;
    const total = list.length;
    const converted = count("converted");
    const closed = converted + count("lost");
    const nowIso = new Date().toISOString();
    const { count: pendingFollowUps } = await supabaseAdmin
      .from("commercial_contact_logs")
      .select("id", { count: "exact", head: true })
      .eq("contact_type", "PILOT_FOLLOWUP")
      .lte("next_follow_up_at", nowIso)
      .not("next_follow_up_at", "is", null);
    return {
      total,
      active:
        count("active") +
        count("ACTIVE_TRIAL") +
        count("USING") +
        count("ONBOARDING") +
        count("INVITED"),
      inProgress: count("in_progress") + count("ONBOARDING") + count("READY_TO_CONVERT"),
      converted: converted + count("CONVERTED"),
      lost: count("lost") + count("LOST"),
      paused: count("paused"),
      conversionRate: closed > 0 ? Math.round((converted / closed) * 100) : 0,
      pendingFollowUps: pendingFollowUps ?? 0,
    };
  });

export type AdminCompanyOption = {
  id: string;
  name: string;
};

export const listCompaniesForPilot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCompanyOption[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id, trade_name, corporate_name")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.trade_name ?? c.corporate_name ?? c.id,
    }));
  });
