/**
 * Open Finance — server functions (createServerFn).
 *
 * NEVER fabricate data. When no provider is configured, return
 * `{ configured: false }` and let the UI render the pending-configuration
 * state. Never expose provider tokens/secrets to the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ConnectionStatus =
  | "PENDING"
  | "CONNECTED"
  | "SYNCING"
  | "ERROR"
  | "EXPIRED"
  | "REVOKED";

export type OpenFinanceConnection = {
  id: string;
  company_id: string;
  provider: string;
  provider_connection_id: string | null;
  provider_item_id: string | null;
  status: ConnectionStatus;
  consent_id: string | null;
  consent_expires_at: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BankAccount = {
  id: string;
  company_id: string;
  openfinance_connection_id: string | null;
  provider: string;
  bank_name: string;
  bank_code: string | null;
  account_name: string | null;
  account_type: string | null;
  agency: string | null;
  account_number_masked: string | null;
  balance: number;
  currency: string;
  consent_status: string | null;
  last_sync_at: string | null;
  active: boolean;
};

export type BankTransaction = {
  id: string;
  company_id: string;
  connection_id: string | null;
  bank_account_id: string | null;
  provider: string;
  provider_transaction_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  reconciliation_status: "PENDING" | "SUGGESTED" | "RECONCILED" | "IGNORED";
  reconciled_transaction_id: string | null;
  category_suggestion: string | null;
};

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa vinculada.");
  return cid;
}

async function hasPermission(supabase: any, slug: string): Promise<boolean> {
  // super_admin/owner bypass — same convention as the client `usePermissions` helper.
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id);
  const rs = new Set((roles ?? []).map((r: any) => r.role));
  if (rs.has("super_admin") || rs.has("owner")) return true;
  // Look up via profile_roles → role_permissions → permissions.slug
  const { data } = await supabase.rpc("has_permission_slug", { _slug: slug });
  return data === true;
}

export const getOpenFinanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await getCompanyId(sb, context.userId);
    const { getOpenFinanceProvider } = await import("./open-finance/provider");
    const s = getOpenFinanceProvider().status();
    return s;
  });

export const listOpenFinanceConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data, error } = await sb
      .from("openfinance_connections")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as OpenFinanceConnection[];
  });

export const listBankAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data, error } = await sb
      .from("financial_bank_accounts")
      .select("*")
      .eq("company_id", companyId)
      .order("bank_name");
    if (error) throw new Error(error.message);
    return (data ?? []) as BankAccount[];
  });

const TxFilters = z
  .object({
    status: z.enum(["PENDING", "SUGGESTED", "RECONCILED", "IGNORED"]).optional(),
    bankAccountId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(500).default(200),
  })
  .default({ limit: 200 });

export const listOpenFinanceTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TxFilters.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    let q = sb
      .from("openfinance_transactions")
      .select("*")
      .eq("company_id", companyId)
      .order("transaction_date", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("reconciliation_status", data.status);
    if (data.bankAccountId) q = q.eq("bank_account_id", data.bankAccountId);
    if (data.from) q = q.gte("transaction_date", data.from);
    if (data.to) q = q.lte("transaction_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as BankTransaction[];
  });

export const createOpenFinanceConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider: z.enum(["PLUGGY", "BELVO", "MANUAL", "OTHER"]).optional(),
      })
      .default({})
      .parse(d ?? {}),
  )
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const { getOpenFinanceProvider } = await import("./open-finance/provider");
    const provider = getOpenFinanceProvider();
    const status = provider.status();
    if (!status.configured) {
      throw new Error(status.reason ?? "Provedor Open Finance não configurado.");
    }

    // 1) create a pending row, 2) ask provider for a connect token.
    const { data: row, error } = await sb
      .from("openfinance_connections")
      .insert({
        company_id: companyId,
        provider: provider.name,
        status: "PENDING",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    let init: { connectToken: string | null; providerConnectionId: string | null } = {
      connectToken: null,
      providerConnectionId: null,
    };
    try {
      init = await provider.initConnection(companyId);
    } catch (e: any) {
      await sb
        .from("openfinance_connections")
        .update({ status: "ERROR", error_message: e?.message ?? String(e) })
        .eq("id", row.id);
      throw e;
    }

    return { connectionId: row.id, connectToken: init.connectToken };
  });

export const syncOpenFinanceAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: conn } = await sb
      .from("openfinance_connections")
      .select("*")
      .eq("id", data.connectionId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!conn) throw new Error("Conexão não encontrada.");

    const { getOpenFinanceProvider } = await import("./open-finance/provider");
    const provider = getOpenFinanceProvider();
    if (!provider.status().configured) throw new Error("Provedor não configurado.");
    if (!conn.provider_connection_id)
      throw new Error("Conexão ainda não autorizada pelo provedor.");

    await sb.from("openfinance_connections").update({ status: "SYNCING" }).eq("id", conn.id);
    try {
      await provider.syncAccounts(conn.provider_connection_id);
      await sb
        .from("openfinance_connections")
        .update({
          status: "CONNECTED",
          last_sync_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", conn.id);
      return { ok: true };
    } catch (e: any) {
      await sb
        .from("openfinance_connections")
        .update({ status: "ERROR", error_message: e?.message ?? String(e) })
        .eq("id", conn.id);
      throw e;
    }
  });

export const syncOpenFinanceTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: conn } = await sb
      .from("openfinance_connections")
      .select("*")
      .eq("id", data.connectionId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!conn) throw new Error("Conexão não encontrada.");

    const { getOpenFinanceProvider } = await import("./open-finance/provider");
    const provider = getOpenFinanceProvider();
    if (!provider.status().configured) throw new Error("Provedor não configurado.");
    if (!conn.provider_connection_id)
      throw new Error("Conexão ainda não autorizada pelo provedor.");

    await provider.syncTransactions(conn.provider_connection_id, { from: data.from, to: data.to });
    await sb
      .from("openfinance_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", conn.id);
    return { ok: true };
  });

export const revokeOpenFinanceConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: conn } = await sb
      .from("openfinance_connections")
      .select("*")
      .eq("id", data.connectionId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!conn) throw new Error("Conexão não encontrada.");

    const { getOpenFinanceProvider } = await import("./open-finance/provider");
    const provider = getOpenFinanceProvider();
    if (provider.status().configured && conn.provider_connection_id) {
      try {
        await provider.revoke(conn.provider_connection_id);
      } catch {
        /* best effort */
      }
    }

    await sb
      .from("openfinance_connections")
      .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
      .eq("id", conn.id);
    await sb
      .from("financial_bank_accounts")
      .update({ active: false, consent_status: "REVOKED" })
      .eq("openfinance_connection_id", conn.id)
      .eq("company_id", companyId);

    return { ok: true };
  });
