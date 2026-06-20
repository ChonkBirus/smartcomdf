import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ROLES = ["owner", "manager", "financial", "commercial", "stock", "technician"] as const;

async function assertOwner(supabase: any, userId: string, companyId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId);
  const isOwner = (data ?? []).some((r: any) => r.role === "owner");
  if (!isOwner) throw new Error("Apenas o proprietário pode executar esta ação.");
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!me?.company_id) return { members: [], invitations: [] };

    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, phone, created_at")
      .eq("company_id", me.company_id)
      .order("created_at", { ascending: true });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("company_id", me.company_id);

    const { data: invitations } = await supabase
      .from("user_invitations")
      .select("id, email, role, status, token, expires_at, created_at")
      .eq("company_id", me.company_id)
      .order("created_at", { ascending: false });

    const byUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role];
    });

    return {
      members: (members ?? []).map((m: any) => ({ ...m, roles: byUser[m.id] ?? [] })),
      invitations: invitations ?? [],
    };
  });

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(APP_ROLES),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!me?.company_id) throw new Error("Sem empresa vinculada.");
    await assertOwner(supabase, userId, me.company_id);

    const { data: inv, error } = await supabase
      .from("user_invitations")
      .insert({
        company_id: me.company_id,
        email: data.email,
        role: data.role,
        invited_by: userId,
      })
      .select("id, email, role, token, expires_at, status")
      .single();
    if (error) throw new Error(error.message);
    return inv;
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!me?.company_id) throw new Error("Sem empresa vinculada.");
    await assertOwner(supabase, userId, me.company_id);

    const { error } = await supabase
      .from("user_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("company_id", me.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), role: z.enum(APP_ROLES) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!me?.company_id) throw new Error("Sem empresa vinculada.");
    await assertOwner(supabase, userId, me.company_id);

    // Replace non-owner roles with the chosen one (keeps owner role intact)
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("company_id", me.company_id)
      .neq("role", "owner");

    if (data.role !== "owner") {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user_id, company_id: me.company_id, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("Você não pode remover a si mesmo.");
    const { data: me } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!me?.company_id) throw new Error("Sem empresa vinculada.");
    await assertOwner(supabase, userId, me.company_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("company_id", me.company_id);
    await supabaseAdmin.from("profiles").update({ company_id: null }).eq("id", data.user_id);
    return { ok: true };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(10).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: companyId, error } = await supabase.rpc("accept_invitation", { _token: data.token });
    if (error) throw new Error(error.message);
    return { company_id: companyId };
  });
