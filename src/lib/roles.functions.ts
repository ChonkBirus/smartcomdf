import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRoleMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: roles }, { data: permissions }, { data: mapping }] = await Promise.all([
      supabase.from("roles").select("id, slug, name, description").order("name"),
      supabase.from("permissions").select("id, slug, module, action, description").order("slug"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
    return { roles: roles ?? [], permissions: permissions ?? [], mapping: mapping ?? [] };
  });

export const toggleRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      role_id: z.string().uuid(),
      permission_id: z.string().uuid(),
      enabled: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Only owner can change role permissions
    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = (rows ?? []).some((r: any) => r.role === "owner" || r.role === "super_admin");
    if (!allowed) throw new Error("Apenas proprietários podem editar permissões.");

    if (data.enabled) {
      const { error } = await supabase
        .from("role_permissions")
        .insert({ role_id: data.role_id, permission_id: data.permission_id });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", data.role_id)
        .eq("permission_id", data.permission_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
