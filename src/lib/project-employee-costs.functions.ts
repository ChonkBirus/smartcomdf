import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProjectEmployeeCost = {
  id: string;
  company_id: string;
  project_id: string;
  service_order_id: string | null;
  employee_id: string;
  employee_name: string;
  role_snapshot: string | null;
  daily_rate_snapshot: number;
  days_count: number;
  transport_cost: number;
  meal_cost: number;
  other_cost: number;
  notes: string | null;
  total: number;
  created_at: string;
  updated_at: string;
};

export type ServiceOrderTeamPublicItem = {
  id: string;
  employee_id: string;
  employee_name: string;
  role_snapshot: string | null;
};

const money = z
  .number({ invalid_type_error: "Valor inválido" })
  .nonnegative("Valor não pode ser negativo")
  .max(1_000_000, "Valor muito alto");

const daysSchema = z
  .number({ invalid_type_error: "Diárias inválidas" })
  .positive("Diárias deve ser maior que 0")
  .max(10_000, "Diárias muito altas");

const upsertPayloadSchema = z.object({
  days_count: daysSchema,
  daily_rate_snapshot: money.optional(),
  transport_cost: money.optional(),
  meal_cost: money.optional(),
  other_cost: money.default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  service_order_id: z.string().uuid().nullable().optional(),
});

const addSchema = upsertPayloadSchema.extend({
  project_id: z.string().uuid(),
  employee_id: z.string().uuid(),
});

const updateSchema = upsertPayloadSchema.extend({
  id: z.string().uuid(),
});

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data, error } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Sem empresa vinculada ao usuário.");
  return data.company_id as string;
}

function computeTotal(row: {
  daily_rate_snapshot: number;
  days_count: number;
  transport_cost: number;
  meal_cost: number;
  other_cost: number;
}) {
  return (
    Number(row.daily_rate_snapshot) * Number(row.days_count) +
    Number(row.transport_cost) +
    Number(row.meal_cost) +
    Number(row.other_cost)
  );
}

async function validateSoBelongsToProject(
  sb: any,
  companyId: string,
  projectId: string,
  serviceOrderId: string | null | undefined,
) {
  if (!serviceOrderId) return;
  const { data, error } = await sb
    .from("service_orders")
    .select("id, project_id, company_id")
    .eq("id", serviceOrderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("OS não encontrada.");
  if (data.company_id !== companyId)
    throw new Error("OS pertence a outra empresa.");
  if (data.project_id !== projectId)
    throw new Error("OS não pertence a este projeto.");
}

function mapRow(r: any): ProjectEmployeeCost {
  const row = {
    ...r,
    daily_rate_snapshot: Number(r.daily_rate_snapshot ?? 0),
    days_count: Number(r.days_count ?? 0),
    transport_cost: Number(r.transport_cost ?? 0),
    meal_cost: Number(r.meal_cost ?? 0),
    other_cost: Number(r.other_cost ?? 0),
  };
  return {
    ...row,
    employee_name: r.employee?.name ?? "—",
    total: computeTotal(row),
  } as ProjectEmployeeCost;
}

export const listProjectEmployeeCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    // RLS blocks unauthorized users (returns empty).
    const { data: rows, error } = await sb
      .from("project_employee_costs")
      .select(
        `id, company_id, project_id, service_order_id, employee_id,
         role_snapshot, daily_rate_snapshot, days_count,
         transport_cost, meal_cost, other_cost, notes,
         created_at, updated_at,
         employee:employee_id(name)`,
      )
      .eq("project_id", data.project_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

export const listServiceOrderEmployeeCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ service_order_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("project_employee_costs")
      .select(
        `id, company_id, project_id, service_order_id, employee_id,
         role_snapshot, daily_rate_snapshot, days_count,
         transport_cost, meal_cost, other_cost, notes,
         created_at, updated_at,
         employee:employee_id(name)`,
      )
      .eq("service_order_id", data.service_order_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

export const addProjectEmployeeCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    // Validate project belongs to company
    const { data: proj, error: projErr } = await sb
      .from("projects")
      .select("id, company_id")
      .eq("id", data.project_id)
      .maybeSingle();
    if (projErr) throw new Error(projErr.message);
    if (!proj || proj.company_id !== companyId)
      throw new Error("Projeto não encontrado.");

    await validateSoBelongsToProject(
      sb,
      companyId,
      data.project_id,
      data.service_order_id ?? null,
    );

    // Snapshot employee
    const { data: emp, error: empErr } = await sb
      .from("employees")
      .select("id, company_id, role, daily_rate, transport_cost, meal_cost, active")
      .eq("id", data.employee_id)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    if (!emp || emp.company_id !== companyId)
      throw new Error("Funcionário não encontrado.");
    if (!emp.active) throw new Error("Funcionário inativo não pode ser vinculado.");

    const payload = {
      company_id: companyId,
      project_id: data.project_id,
      service_order_id: data.service_order_id ?? null,
      employee_id: data.employee_id,
      role_snapshot: emp.role ?? null,
      daily_rate_snapshot:
        data.daily_rate_snapshot ?? Number(emp.daily_rate ?? 0),
      days_count: data.days_count,
      transport_cost: data.transport_cost ?? Number(emp.transport_cost ?? 0),
      meal_cost: data.meal_cost ?? Number(emp.meal_cost ?? 0),
      other_cost: data.other_cost ?? 0,
      notes: data.notes || null,
      created_by: context.userId,
    };

    const { data: row, error } = await sb
      .from("project_employee_costs")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateProjectEmployeeCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const { data: existing, error: exErr } = await sb
      .from("project_employee_costs")
      .select("id, company_id, project_id")
      .eq("id", data.id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing || existing.company_id !== companyId)
      throw new Error("Vínculo não encontrado.");

    if (data.service_order_id !== undefined) {
      await validateSoBelongsToProject(
        sb,
        companyId,
        existing.project_id,
        data.service_order_id,
      );
    }

    const update: Record<string, any> = {
      days_count: data.days_count,
      other_cost: data.other_cost ?? 0,
      notes: data.notes || null,
    };
    if (data.daily_rate_snapshot !== undefined)
      update.daily_rate_snapshot = data.daily_rate_snapshot;
    if (data.transport_cost !== undefined)
      update.transport_cost = data.transport_cost;
    if (data.meal_cost !== undefined) update.meal_cost = data.meal_cost;
    if (data.service_order_id !== undefined)
      update.service_order_id = data.service_order_id;

    const { error } = await sb
      .from("project_employee_costs")
      .update(update)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const deleteProjectEmployeeCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("project_employee_costs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listServiceOrderTeamPublic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ service_order_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb.rpc(
      "list_service_order_team_public",
      { _service_order_id: data.service_order_id },
    );
    if (error) throw new Error(error.message);
    return (rows ?? []) as ServiceOrderTeamPublicItem[];
  });
