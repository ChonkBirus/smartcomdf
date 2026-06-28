// Pilot feedback / bugs CRUD (super admin only).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TYPES = ["FEEDBACK", "BUG", "SUGGESTION", "QUESTION"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "WONT_FIX", "CLOSED"] as const;

export const PILOT_FEEDBACK_TYPES = TYPES;
export const PILOT_FEEDBACK_PRIORITIES = PRIORITIES;
export const PILOT_FEEDBACK_STATUSES = STATUSES;

export type PilotFeedbackRow = {
  id: string;
  pilot_id: string | null;
  company_id: string;
  feedback_type: string;
  module: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  screen: string | null;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;
  assignee: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Acesso restrito a Super Admins.");
}

export const listPilotFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pilot_id?: string | null; company_id?: string | null; status?: string | null; feedback_type?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<PilotFeedbackRow[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("pilot_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.pilot_id) q = q.eq("pilot_id", data.pilot_id);
    if (data.company_id) q = q.eq("company_id", data.company_id);
    if (data.status && data.status !== "ALL") q = q.eq("status", data.status);
    if (data.feedback_type && data.feedback_type !== "ALL") q = q.eq("feedback_type", data.feedback_type);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as PilotFeedbackRow[];
  });

const createSchema = z.object({
  pilot_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid(),
  feedback_type: z.enum(TYPES).default("FEEDBACK"),
  module: z.string().max(120).nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  status: z.enum(STATUSES).default("OPEN"),
  screen: z.string().max(200).nullable().optional(),
  steps_to_reproduce: z.string().max(4000).nullable().optional(),
  expected_result: z.string().max(2000).nullable().optional(),
  actual_result: z.string().max(2000).nullable().optional(),
  assignee: z.string().max(200).nullable().optional(),
});

export const createPilotFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("pilot_feedback")
      .insert({ ...data, submitted_by: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

export const updatePilotFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data as any;
    if (patch.status === "RESOLVED" || patch.status === "CLOSED") {
      patch.resolved_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin
      .from("pilot_feedback")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deletePilotFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pilot_feedback").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getPilotDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pilot, error } = await supabaseAdmin
      .from("commercial_pilots")
      .select("*, companies:company_id(trade_name, corporate_name, email, whatsapp)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!pilot) throw new Error("Piloto não encontrado.");
    const { data: act } = await supabaseAdmin.rpc("get_pilot_activation", {
      _company_id: (pilot as any).company_id,
    });
    return {
      pilot: {
        ...(pilot as any),
        company_name: (pilot as any).companies?.trade_name ?? (pilot as any).companies?.corporate_name ?? null,
        company_email: (pilot as any).companies?.email ?? null,
        company_whatsapp: (pilot as any).companies?.whatsapp ?? null,
      },
      activation: (act as any) ?? { score: 0, tier: "LOW", counts: {}, checklist: {} },
    };
  });
