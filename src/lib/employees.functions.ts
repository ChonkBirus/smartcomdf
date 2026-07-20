import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Employee = {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  document: string | null;
  role: string | null;
  daily_rate: number;
  transport_cost: number;
  meal_cost: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeePickerItem = {
  id: string;
  name: string;
  role: string | null;
};

const money = z
  .number({ invalid_type_error: "Valor inválido" })
  .nonnegative("Valor não pode ser negativo")
  .max(1_000_000, "Valor muito alto");

const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Nome obrigatório").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  document: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.string().trim().max(80).optional().or(z.literal("")),
  daily_rate: money.default(0),
  transport_cost: money.default(0),
  meal_cost: money.default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data: prof, error } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prof?.company_id) throw new Error("Sem empresa vinculada ao usuário.");
  return prof.company_id as string;
}

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().optional(),
        role: z.string().optional(),
        active: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    let q = sb
      .from("employees")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("active", { ascending: false })
      .order("name", { ascending: true });
    if (typeof data.active === "boolean") q = q.eq("active", data.active);
    if (data.role?.trim()) q = q.ilike("role", `%${data.role.trim()}%`);
    if (data.search?.trim()) {
      const s = data.search.trim().replace(/[%,]/g, "");
      q = q.or(`name.ilike.%${s}%,role.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Employee[];
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => employeeSchema.omit({ id: true }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const payload = {
      company_id: companyId,
      name: data.name,
      phone: data.phone || null,
      document: data.document || null,
      role: data.role || null,
      daily_rate: data.daily_rate,
      transport_cost: data.transport_cost,
      meal_cost: data.meal_cost,
      notes: data.notes || null,
      active: data.active,
      created_by: context.userId,
    };
    const { data: row, error } = await sb
      .from("employees")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => employeeSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const payload = {
      name: data.name,
      phone: data.phone || null,
      document: data.document || null,
      role: data.role || null,
      daily_rate: data.daily_rate,
      transport_cost: data.transport_cost,
      meal_cost: data.meal_cost,
      notes: data.notes || null,
      active: data.active,
    };
    const { error } = await sb
      .from("employees")
      .update(payload)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const toggleEmployeeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("employees")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listActiveEmployeesForPicker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data, error } = await sb
      .from("employees")
      .select("id, name, role")
      .eq("company_id", companyId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeePickerItem[];
  });
