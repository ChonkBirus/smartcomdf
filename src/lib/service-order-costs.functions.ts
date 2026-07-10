import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServiceOrderCost = {
  id: string;
  service_order_id: string;
  project_id: string | null;
  description: string;
  amount: number;
  status: "PAID" | "PLANNED" | "CANCELED";
  due_date: string | null;
  paid_at: string | null;
  category_id: string | null;
  category_name: string | null;
  bank_account_id: string | null;
  payment_method: string | null;
  created_at: string;
};

async function getProfile(sb: any, userId: string) {
  const { data } = await sb
    .from("profiles")
    .select("company_id, is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa vinculada.");
  return { company_id: cid, is_super_admin: !!data?.is_super_admin };
}

async function assertCanManageCost(sb: any, userId: string) {
  const { is_super_admin } = await getProfile(sb, userId);
  if (is_super_admin) return;
  // Owner via user_roles / role slug 'owner' or 'admin'
  const { data: roleRows } = await sb
    .from("user_roles")
    .select("roles(slug)")
    .eq("user_id", userId);
  const roleSlugs = new Set<string>(
    (roleRows ?? [])
      .map((r: any) => r?.roles?.slug)
      .filter(Boolean),
  );
  if (roleSlugs.has("owner") || roleSlugs.has("admin")) return;

  // Otherwise check granular permissions
  const { data: permRows } = await sb.rpc("user_has_any_permission", {
    _user_id: userId,
    _slugs: ["service_orders.manage", "finance.manage", "finance.transactions.manage"],
  } as any);
  // Fallback: query role_permissions directly if RPC not available
  if (permRows === true) return;
  const { data: perms } = await sb
    .from("user_roles")
    .select("roles(role_permissions(permissions(slug)))")
    .eq("user_id", userId);
  const slugs = new Set<string>();
  (perms ?? []).forEach((ur: any) => {
    (ur?.roles?.role_permissions ?? []).forEach((rp: any) => {
      const s = rp?.permissions?.slug;
      if (s) slugs.add(s);
    });
  });
  if (
    slugs.has("service_orders.manage") ||
    slugs.has("finance.manage") ||
    slugs.has("finance.transactions.manage")
  ) {
    return;
  }
  throw new Error("Sem permissão para lançar custos avulsos.");
}

async function loadServiceOrder(sb: any, cid: string, soId: string) {
  const { data: so, error } = await sb
    .from("service_orders")
    .select("id, company_id, project_id, status")
    .eq("id", soId)
    .eq("company_id", cid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!so) throw new Error("OS não encontrada.");
  return so as { id: string; company_id: string; project_id: string | null; status: string };
}

export const listServiceOrderCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ service_order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { company_id } = await getProfile(context.supabase, context.userId);
    await loadServiceOrder(context.supabase, company_id, data.service_order_id);
    const { data: rows, error } = await context.supabase
      .from("financial_transactions")
      .select("id, service_order_id, project_id, description, amount, status, due_date, paid_at, category_id, bank_account_id, payment_method, created_at, financial_categories(name)")
      .eq("company_id", company_id)
      .eq("service_order_id", data.service_order_id)
      .eq("origin_type", "SERVICE_ORDER_COST")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): ServiceOrderCost => ({
      id: r.id,
      service_order_id: r.service_order_id,
      project_id: r.project_id,
      description: r.description,
      amount: Number(r.amount ?? 0),
      status: r.status,
      due_date: r.due_date,
      paid_at: r.paid_at,
      category_id: r.category_id,
      category_name: r.financial_categories?.name ?? null,
      bank_account_id: r.bank_account_id,
      payment_method: r.payment_method,
      created_at: r.created_at,
    }));
  });

const CreateSchema = z.object({
  service_order_id: z.string().uuid(),
  description: z.string().min(1).max(240),
  amount: z.number().finite().positive(),
  category_id: z.string().uuid(),
  status: z.enum(["PAID", "PLANNED"]),
  due_date: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  payment_method: z.string().max(40).nullable().optional(),
});

async function validateCategory(sb: any, cid: string, categoryId: string) {
  const { data: cat, error } = await sb
    .from("financial_categories")
    .select("id, company_id, type, active")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cat || cat.company_id !== cid) throw new Error("Categoria inválida.");
  if (cat.type !== "EXPENSE") throw new Error("Categoria precisa ser de despesa.");
  if (cat.active === false) throw new Error("Categoria inativa.");
}

async function validateBankAccount(sb: any, cid: string, bankId: string) {
  const { data: acc, error } = await sb
    .from("financial_bank_accounts")
    .select("id, company_id, active")
    .eq("id", bankId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!acc || acc.company_id !== cid) throw new Error("Conta bancária inválida.");
  if (acc.active === false) throw new Error("Conta bancária inativa.");
}

export const createServiceOrderCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { company_id } = await getProfile(context.supabase, context.userId);
    await assertCanManageCost(context.supabase, context.userId);
    const so = await loadServiceOrder(context.supabase, company_id, data.service_order_id);
    await validateCategory(context.supabase, company_id, data.category_id);

    const isPaid = data.status === "PAID";
    if (!isPaid && !data.due_date) throw new Error("Informe a data de vencimento.");
    if (isPaid && data.bank_account_id) {
      await validateBankAccount(context.supabase, company_id, data.bank_account_id);
    }

    const { data: row, error } = await context.supabase
      .from("financial_transactions")
      .insert({
        company_id,
        type: "EXPENSE",
        status: data.status,
        origin: "SERVICE_ORDER",
        origin_type: "SERVICE_ORDER_COST",
        service_order_id: so.id,
        project_id: so.project_id,
        category_id: data.category_id,
        description: data.description,
        amount: data.amount,
        due_date: !isPaid ? data.due_date : (data.due_date ?? new Date().toISOString().slice(0, 10)),
        paid_at: isPaid ? (data.paid_at ?? new Date().toISOString()) : null,
        bank_account_id: isPaid ? (data.bank_account_id ?? null) : null,
        payment_method: isPaid ? (data.payment_method ?? null) : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

const UpdateSchema = CreateSchema.partial().extend({ id: z.string().uuid() });

export const updateServiceOrderCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { company_id } = await getProfile(context.supabase, context.userId);
    await assertCanManageCost(context.supabase, context.userId);

    const { data: existing, error: eerr } = await context.supabase
      .from("financial_transactions")
      .select("id, company_id, origin_type, status, service_order_id")
      .eq("id", data.id)
      .maybeSingle();
    if (eerr) throw new Error(eerr.message);
    if (!existing || existing.company_id !== company_id) throw new Error("Custo não encontrado.");
    if (existing.origin_type !== "SERVICE_ORDER_COST") throw new Error("Transação não é custo de OS.");
    if (existing.status === "CANCELED") throw new Error("Custo cancelado.");

    if (data.category_id) await validateCategory(context.supabase, company_id, data.category_id);
    if (data.bank_account_id) await validateBankAccount(context.supabase, company_id, data.bank_account_id);

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.description !== undefined) patch.description = data.description;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.category_id !== undefined) patch.category_id = data.category_id;
    if (data.due_date !== undefined) patch.due_date = data.due_date;
    if (data.paid_at !== undefined) patch.paid_at = data.paid_at;
    if (data.bank_account_id !== undefined) patch.bank_account_id = data.bank_account_id;
    if (data.payment_method !== undefined) patch.payment_method = data.payment_method;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "PAID" && !patch.paid_at) patch.paid_at = new Date().toISOString();
      if (data.status === "PLANNED") patch.paid_at = null;
    }

    const { error } = await (context.supabase as any)
      .from("financial_transactions")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelServiceOrderCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { company_id } = await getProfile(context.supabase, context.userId);
    await assertCanManageCost(context.supabase, context.userId);
    const { data: existing } = await context.supabase
      .from("financial_transactions")
      .select("id, company_id, origin_type")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing || existing.company_id !== company_id) throw new Error("Custo não encontrado.");
    if (existing.origin_type !== "SERVICE_ORDER_COST") throw new Error("Transação não é custo de OS.");
    const { error } = await context.supabase
      .from("financial_transactions")
      .update({ status: "CANCELED", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("company_id", company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
