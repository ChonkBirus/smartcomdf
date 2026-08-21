import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listSchema = z
  .object({
    module: z.string().trim().max(50).optional(),
    action: z.string().trim().max(50).optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })
  .default({ limit: 100 });

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    const companyId = prof?.company_id;
    if (!companyId) throw new Error("Sem empresa vinculada.");
    let q = sb
      .from("audit_logs")
      .select("id, module, action, record_id, user_id, created_at, new_data, old_data")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.module) q = q.eq("module", data.module);
    if (data.action) q = q.eq("action", data.action);
    const { data: logs, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set((logs ?? []).map((l: any) => l.user_id).filter(Boolean) as string[]),
    );
    let usersById = new Map<string, { full_name: string | null; email: string | null }>();
    if (userIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      usersById = new Map(
        (profs ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
      );
    }
    return (logs ?? []).map((l: any) => ({
      ...l,
      user: l.user_id ? (usersById.get(l.user_id) ?? null) : null,
    }));
  });

export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    const companyId = prof?.company_id;
    if (!companyId) throw new Error("Sem empresa vinculada.");
    const { data, error } = await sb
      .from("activity_logs")
      .select("id, description, user_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
