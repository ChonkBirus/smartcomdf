import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const STATUSES = ["open", "in_progress", "fixed", "wont_fix", "closed"] as const;

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listQaBugs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("qa_bugs")
      .select("id, screen, description, impact, root_cause, fix, priority, status, assignee, created_at, updated_at")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const createQaBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        screen: z.string().min(1).max(200),
        description: z.string().min(1).max(4000),
        impact: z.string().max(2000).nullable().optional(),
        root_cause: z.string().max(2000).nullable().optional(),
        fix: z.string().max(2000).nullable().optional(),
        priority: z.enum(PRIORITIES).default("P2"),
        status: z.enum(STATUSES).default("open"),
        assignee: z.string().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("qa_bugs")
      .insert({ ...data, reporter_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateQaBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        screen: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(4000).optional(),
        impact: z.string().max(2000).nullable().optional(),
        root_cause: z.string().max(2000).nullable().optional(),
        fix: z.string().max(2000).nullable().optional(),
        priority: z.enum(PRIORITIES).optional(),
        status: z.enum(STATUSES).optional(),
        assignee: z.string().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { id, ...patch } = data;
    const { error } = await supabase.from("qa_bugs").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQaBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("qa_bugs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
