import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FinTxType = "INCOME" | "EXPENSE";
export type FinTxStatus = "PLANNED" | "PAID" | "OVERDUE" | "CANCELED" | "RECONCILED";
export type FinTxOrigin =
  | "MANUAL" | "QUOTE" | "PAYMENT" | "PURCHASE"
  | "SERVICE_ORDER" | "OPEN_FINANCE" | "IMPORT";

export type CostBehavior = "FIXED" | "VARIABLE";
export type CategoryGroup =
  | "REVENUE" | "VARIABLE_COST" | "FIXED_EXPENSE"
  | "INVESTMENT" | "NON_OPERATIONAL" | "CASH_ADJUSTMENT";

export type FinancialCategory = {
  id: string;
  company_id: string;
  name: string;
  type: FinTxType;
  parent_id: string | null;
  active: boolean;
  is_default: boolean;
  code: string | null;
  level: number | null;
  sort_order: number;
  cost_behavior: CostBehavior | null;
  category_group: CategoryGroup | null;
  created_at: string;
  updated_at: string;
};

export type FinancialTransaction = {
  id: string;
  company_id: string;
  type: FinTxType;
  category_id: string | null;
  category_name?: string | null;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: FinTxStatus;
  customer_id: string | null;
  customer_name?: string | null;
  supplier_id: string | null;
  supplier_name?: string | null;
  quote_id: string | null;
  project_id: string | null;
  service_order_id: string | null;
  purchase_id: string | null;
  payment_method: string | null;
  origin: FinTxOrigin;
  notes: string | null;
  bank_account_id: string | null;
  bank_account_name?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};


async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa.");
  return cid;
}

const FiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  status: z.enum(["PLANNED", "PAID", "OVERDUE", "CANCELED", "RECONCILED"]).optional(),
  categoryId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
}).default({});

function effectiveStatus(t: { status: FinTxStatus; due_date: string | null }): FinTxStatus {
  if (t.status === "PLANNED" && t.due_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(t.due_date) < today) return "OVERDUE";
  }
  return t.status;
}

function applyFilters(q: any, f: z.infer<typeof FiltersSchema>) {
  if (f.type) q = q.eq("type", f.type);
  if (f.status) q = q.eq("status", f.status);
  if (f.categoryId) q = q.eq("category_id", f.categoryId);
  if (f.customerId) q = q.eq("customer_id", f.customerId);
  if (f.supplierId) q = q.eq("supplier_id", f.supplierId);
  if (f.from) q = q.or(`due_date.gte.${f.from},paid_at.gte.${f.from}`);
  if (f.to) q = q.or(`due_date.lte.${f.to},paid_at.lte.${f.to}`);
  return q;
}

function mapRow(r: any): FinancialTransaction {
  return {
    ...r,
    amount: Number(r.amount ?? 0),
    category_name: r.financial_categories?.name ?? null,
    customer_name: r.customers?.name ?? null,
    supplier_name: r.suppliers?.name ?? null,
    bank_account_name: r.financial_bank_accounts
      ? (r.financial_bank_accounts.account_name
          ? `${r.financial_bank_accounts.bank_name} — ${r.financial_bank_accounts.account_name}`
          : r.financial_bank_accounts.bank_name)
      : null,
  };
}


// ---------- Categories ----------

export const ensureDefaultFinancialCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    await context.supabase.rpc("seed_default_financial_categories", { _company_id: cid });
    return { ok: true };
  });

export const listFinancialCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type?: FinTxType; activeOnly?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    let q = context.supabase.from("financial_categories").select("*").eq("company_id", cid);
    if (data.type) q = q.eq("type", data.type);
    if (data.activeOnly !== false) q = q.eq("active", true);
    const { data: rows, error } = await q.order("type").order("name");
    if (error) throw error;
    return (rows ?? []) as FinancialCategory[];
  });

export const createFinancialCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; type: FinTxType; parent_id?: string | null }) =>
    z.object({
      name: z.string().min(1).max(120),
      type: z.enum(["INCOME", "EXPENSE"]),
      parent_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("financial_categories")
      .insert({ company_id: cid, name: data.name, type: data.type, parent_id: data.parent_id ?? null })
      .select("*").single();
    if (error) throw error;
    return row as FinancialCategory;
  });

export const updateFinancialCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name?: string; active?: boolean }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.active !== undefined) patch.active = data.active;
    const { data: row, error } = await context.supabase.from("financial_categories")
      .update(patch).eq("id", data.id).select("*").single();
    if (error) throw error;
    return row as FinancialCategory;
  });

export const deactivateFinancialCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("financial_categories")
      .update({ active: false }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Transactions ----------

const TxInputSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().min(1).max(300),
  amount: z.number().nonnegative(),
  due_date: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  status: z.enum(["PLANNED", "PAID", "OVERDUE", "CANCELED", "RECONCILED"]).default("PLANNED"),
  category_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  payment_method: z.string().max(60).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
});


export const listFinancialTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    let q = context.supabase.from("financial_transactions")
      .select("*, financial_categories(name), customers(name), suppliers(name), financial_bank_accounts(bank_name, account_name)")
      .eq("company_id", cid);

    q = applyFilters(q, data);
    const { data: rows, error } = await q.order("due_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []).map(mapRow);
  });

export const createFinancialTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TxInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("financial_transactions")
      .insert({
        company_id: cid,
        created_by: context.userId,
        origin: "MANUAL",
        ...data,
      })
      .select("*").single();
    if (error) throw error;
    return row as FinancialTransaction;
  });

export const updateFinancialTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(TxInputSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data as any;
    const { data: row, error } = await context.supabase.from("financial_transactions")
      .update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return row as FinancialTransaction;
  });

export const softDeleteFinancialTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("financial_transactions")
      .update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const markTransactionAsPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; paid_at?: string }) =>
    z.object({ id: z.string().uuid(), paid_at: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("financial_transactions")
      .update({ status: "PAID", paid_at: data.paid_at ?? new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const cancelFinancialTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("financial_transactions")
      .update({ status: "CANCELED" }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Overview / CashFlow / Receivables / Payables ----------

export type FinanceOverview = {
  income: number;
  expense: number;
  balance: number;
  receivables: number;
  payables: number;
  overdueReceivables: number;
  overduePayables: number;
};

export const getFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<FinanceOverview> => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.from("financial_transactions")
      .select("type,amount,status,due_date,paid_at")
      .eq("company_id", cid);
    if (error) throw error;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = data.from ? new Date(data.from) : null;
    const to = data.to ? new Date(data.to) : null;
    const o: FinanceOverview = { income: 0, expense: 0, balance: 0, receivables: 0, payables: 0, overdueReceivables: 0, overduePayables: 0 };
    for (const r of rows ?? []) {
      const amt = Number(r.amount ?? 0);
      const refDate = r.paid_at ? new Date(r.paid_at) : (r.due_date ? new Date(r.due_date) : null);
      const inRange = (!from || (refDate && refDate >= from)) && (!to || (refDate && refDate <= to));
      const eff = effectiveStatus(r as any);
      if (r.status === "PAID" && inRange) {
        if (r.type === "INCOME") o.income += amt; else o.expense += amt;
      }
      if (r.type === "INCOME" && (eff === "PLANNED" || eff === "OVERDUE")) {
        o.receivables += amt;
        if (eff === "OVERDUE") o.overdueReceivables += amt;
      }
      if (r.type === "EXPENSE" && (eff === "PLANNED" || eff === "OVERDUE")) {
        o.payables += amt;
        if (eff === "OVERDUE") o.overduePayables += amt;
      }
    }
    o.balance = o.income - o.expense;
    return o;
  });

export const getCashFlow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    let q = context.supabase.from("financial_transactions")
      .select("*, financial_categories(name), financial_bank_accounts(bank_name, account_name)")
      .eq("company_id", cid);

    q = applyFilters(q, data);
    const { data: rows, error } = await q.order("due_date", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (rows ?? []).map(mapRow);
  });

export const getReceivables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.from("financial_transactions")
      .select("*, financial_categories(name), customers(name), financial_bank_accounts(bank_name, account_name)")
      .eq("company_id", cid)

      .eq("type", "INCOME")
      .in("status", ["PLANNED", "PAID", "OVERDUE", "CANCELED"])
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (rows ?? []).map(mapRow);
  });

export const getPayables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.from("financial_transactions")
      .select("*, financial_categories(name), suppliers(name), financial_bank_accounts(bank_name, account_name)")
      .eq("company_id", cid)

      .eq("type", "EXPENSE")
      .in("status", ["PLANNED", "PAID", "OVERDUE", "CANCELED"])
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (rows ?? []).map(mapRow);
  });
