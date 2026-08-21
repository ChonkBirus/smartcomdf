import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MaterialStatus =
  | "NOT_CHECKED"
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "UNAVAILABLE"
  | "RESERVED";
export type PlanningStatus = "PENDING" | "IN_PROGRESS" | "READY_FOR_SERVICE_ORDER";
export type MaterialCheckStatus =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "UNAVAILABLE"
  | "NOT_APPLICABLE";

export type TeamMember = {
  id: string;
  user_id: string;
  role: string | null;
  full_name: string | null;
  email: string | null;
};

export type MaterialCheck = {
  id: string;
  project_item_id: string;
  item_id: string | null;
  name: string;
  unit: string;
  image_url: string | null;
  required_quantity: number;
  available_quantity: number;
  missing_quantity: number;
  status: MaterialCheckStatus;
  checked_at: string | null;
};

export const listCompanyUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa vinculada.");
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, email, active")
      .eq("company_id", prof.company_id)
      .eq("active", true)
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>;
  });

export const getProjectPlanning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa vinculada.");
    const { data: proj } = await sb
      .from("projects")
      .select("id")
      .eq("id", data.project_id)
      .eq("company_id", prof.company_id)
      .maybeSingle();
    if (!proj) throw new Error("Projeto não encontrado.");
    const { data: team, error: e1 } = await sb
      .from("project_team_members")
      .select("id, user_id, role")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: true });
    if (e1) throw new Error(e1.message);

    const userIds = Array.from(new Set((team ?? []).map((m: any) => m.user_id).filter(Boolean)));
    const profMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profs ?? [])
        profMap[(p as any).id] = { full_name: (p as any).full_name, email: (p as any).email };
    }

    const { data: checks, error: e2 } = await sb
      .from("project_material_checks")
      .select(
        `id, project_item_id, item_id, required_quantity, available_quantity,
               missing_quantity, status, checked_at,
               project_items:project_item_id(name, unit, image_url)`,
      )
      .eq("project_id", data.project_id);
    if (e2) throw new Error(e2.message);

    const members: TeamMember[] = (team ?? []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      full_name: profMap[m.user_id]?.full_name ?? null,
      email: profMap[m.user_id]?.email ?? null,
    }));

    const materials: MaterialCheck[] = (checks ?? []).map((c: any) => ({
      id: c.id,
      project_item_id: c.project_item_id,
      item_id: c.item_id,
      name: c.project_items?.name ?? "—",
      unit: c.project_items?.unit ?? "UN",
      image_url: c.project_items?.image_url ?? null,
      required_quantity: Number(c.required_quantity || 0),
      available_quantity: Number(c.available_quantity || 0),
      missing_quantity: Number(c.missing_quantity || 0),
      status: c.status,
      checked_at: c.checked_at,
    }));
    return { team: members, materials };
  });

export const updateProjectPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        responsible_user_id: z.string().uuid().nullable().optional(),
        planned_start_date: z.string().nullable().optional(),
        planned_end_date: z.string().nullable().optional(),
        planned_start_time: z.string().nullable().optional(),
        planned_end_time: z.string().nullable().optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
        operational_notes: z.string().nullable().optional(),
        customer_instructions: z.string().nullable().optional(),
        access_instructions: z.string().nullable().optional(),
        parking_instructions: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("update_project_planning", {
      _id: data.id,
      _responsible_user_id: data.responsible_user_id ?? null,
      _planned_start_date: data.planned_start_date ?? null,
      _planned_end_date: data.planned_end_date ?? null,
      _planned_start_time: data.planned_start_time ?? null,
      _planned_end_time: data.planned_end_time ?? null,
      _priority: data.priority ?? null,
      _operational_notes: data.operational_notes ?? null,
      _customer_instructions: data.customer_instructions ?? null,
      _access_instructions: data.access_instructions ?? null,
      _parking_instructions: data.parking_instructions ?? null,
      _clear_responsible: data.responsible_user_id === null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        user_id: z.string().uuid(),
        role: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("add_project_team_member", {
      _project_id: data.project_id,
      _user_id: data.user_id,
      _role: data.role ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("remove_project_team_member", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkProjectMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: result, error } = await sb.rpc("check_project_materials", {
      _project_id: data.project_id,
    });
    if (error) throw new Error(error.message);
    return result as any;
  });

export const markReadyForOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        force: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("mark_project_ready_for_os", {
      _project_id: data.project_id,
      _force: data.force ?? false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
