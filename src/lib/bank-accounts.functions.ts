import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BankAccount = {
  id: string;
  company_id: string;
  bank_name: string;
  account_type: string | null;
  account_name: string | null;
  balance: number;
  active: boolean;
  provider: string;
  created_at: string;
  updated_at: string;
};

export type BankAccountBalance = {
  id: string;
  name: string;
  account_type: string | null;
  initial_balance: number;
  income: number;
  expense: number;
  balance: number;
  active: boolean;
};

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa.");
  return cid;
}

export const listBankAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { activeOnly?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    let q = context.supabase
      .from("financial_bank_accounts")
      .select("id, company_id, bank_name, account_type, account_name, balance, active, provider, created_at, updated_at")
      .eq("company_id", cid);
    if (data.activeOnly !== false) q = q.eq("active", true);
    const { data: rows, error } = await q.order("active", { ascending: false }).order("bank_name");
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({ ...r, balance: Number(r.balance ?? 0) })) as BankAccount[];
  });

const AccountInputSchema = z.object({
  bank_name: z.string().min(1).max(120),
  account_type: z.string().max(40).nullable().optional(),
  account_name: z.string().max(120).nullable().optional(),
  balance: z.number().finite().optional(),
});

export const createBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AccountInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("financial_bank_accounts")
      .insert({
        company_id: cid,
        provider: "MANUAL",
        bank_name: data.bank_name,
        account_type: data.account_type ?? null,
        account_name: data.account_name ?? null,
        balance: data.balance ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as BankAccount;
  });

export const updateBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(AccountInputSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data as any;
    const { data: row, error } = await context.supabase
      .from("financial_bank_accounts")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return row as BankAccount;
  });

export const setBankAccountActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("financial_bank_accounts")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Balances by account = initial balance + PAID incomes − PAID expenses
 * (deleted transactions excluded).
 */
export const getBankAccountBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BankAccountBalance[]> => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const [{ data: accs, error: e1 }, { data: txs, error: e2 }] = await Promise.all([
      context.supabase
        .from("financial_bank_accounts")
        .select("id, bank_name, account_name, account_type, balance, active")
        .eq("company_id", cid),
      context.supabase
        .from("financial_transactions")
        .select("bank_account_id, type, amount, status")
        .eq("company_id", cid)
        .is("deleted_at", null)
        .eq("status", "PAID"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const agg = new Map<string, { income: number; expense: number }>();
    for (const t of txs ?? []) {
      if (!t.bank_account_id) continue;
      const cur = agg.get(t.bank_account_id) ?? { income: 0, expense: 0 };
      const amt = Number(t.amount ?? 0);
      if (t.type === "INCOME") cur.income += amt;
      else cur.expense += amt;
      agg.set(t.bank_account_id, cur);
    }

    return (accs ?? []).map((a: any) => {
      const s = agg.get(a.id) ?? { income: 0, expense: 0 };
      const initial = Number(a.balance ?? 0);
      return {
        id: a.id,
        name: a.account_name ? `${a.bank_name} — ${a.account_name}` : a.bank_name,
        account_type: a.account_type,
        initial_balance: initial,
        income: s.income,
        expense: s.expense,
        balance: initial + s.income - s.expense,
        active: !!a.active,
      };
    });
  });
