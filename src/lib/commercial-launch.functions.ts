// Super-admin commercial launch: readiness checklist + summary metrics.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Acesso restrito a Super Admins.");
}

export type LaunchChecklistItem = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  sort_order: number;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
};

export type LaunchReadiness = {
  checklistTotal: number;
  checklistDone: number;
  checklistPercent: number;
  providerConfigured: boolean;
  hasActivePlan: boolean;
  hasTermsAndPrivacy: boolean;
  hasSupportChannels: boolean;
  hasActiveDunningRules: boolean;
  activePilots: number;
  convertedPilots: number;
  lostPilots: number;
};

export const getLaunchChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LaunchChecklistItem[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("commercial_launch_checklist")
      .select("id, key, title, description, sort_order, completed, completed_at, completed_by")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as LaunchChecklistItem[];
  });

export const toggleLaunchChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; completed: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("commercial_launch_checklist")
      .update({
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
        completed_by: data.completed ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getLaunchReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LaunchReadiness> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [checklistRes, providerRes, plansRes, dunningRes, pilotsRes] = await Promise.all([
      supabaseAdmin
        .from("commercial_launch_checklist")
        .select("completed", { count: "exact" }),
      supabaseAdmin
        .from("billing_provider_settings")
        .select("provider, api_key_secret_name, terms_of_use_url, privacy_policy_url, support_whatsapp, support_email")
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("plans")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabaseAdmin
        .from("billing_dunning_rules")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabaseAdmin.from("commercial_pilots").select("status"),
    ]);

    const items = (checklistRes.data ?? []) as Array<{ completed: boolean }>;
    const total = items.length;
    const done = items.filter((i) => i.completed).length;
    const provider = providerRes.data;
    const pilots = (pilotsRes.data ?? []) as Array<{ status: string }>;

    return {
      checklistTotal: total,
      checklistDone: done,
      checklistPercent: total > 0 ? Math.round((done / total) * 100) : 0,
      providerConfigured: !!provider?.api_key_secret_name,
      hasActivePlan: (plansRes.count ?? 0) > 0,
      hasTermsAndPrivacy: !!provider?.terms_of_use_url && !!provider?.privacy_policy_url,
      hasSupportChannels: !!(provider?.support_whatsapp || provider?.support_email),
      hasActiveDunningRules: (dunningRes.count ?? 0) > 0,
      activePilots: pilots.filter((p) => p.status === "active" || p.status === "in_progress").length,
      convertedPilots: pilots.filter((p) => p.status === "converted").length,
      lostPilots: pilots.filter((p) => p.status === "lost").length,
    };
  });
