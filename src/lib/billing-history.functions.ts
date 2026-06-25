import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CommercialHistoryActorType = "USER" | "ADMIN" | "SYSTEM" | "WEBHOOK";
export type CommercialHistorySource =
  | "subscription_event"
  | "billing_charge"
  | "coupon_redemption";

export type CommercialHistoryEntry = {
  id: string;
  company_id: string;
  subscription_id: string | null;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  amount: number | null;
  actor_type: CommercialHistoryActorType;
  actor_name: string | null;
  source: CommercialHistorySource;
};

export type CommercialHistoryFilters = {
  subscriptionId?: string;
  source?: CommercialHistorySource | "ALL";
  fromDate?: string; // ISO
  toDate?: string; // ISO
  page?: number;
  pageSize?: number;
};

export type CommercialHistoryResult = {
  entries: CommercialHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export const getSubscriptionCommercialHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CommercialHistoryFilters | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<CommercialHistoryResult> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) {
      return { entries: [], total: 0, page: 1, pageSize: data.pageSize ?? 20 };
    }

    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, data.pageSize ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = (supabase as any)
      .from("subscription_commercial_history")
      .select("*", { count: "exact" })
      .eq("company_id", companyId);

    if (data.subscriptionId) q = q.eq("subscription_id", data.subscriptionId);
    if (data.source && data.source !== "ALL") q = q.eq("source", data.source);
    if (data.fromDate) q = q.gte("event_date", data.fromDate);
    if (data.toDate) q = q.lte("event_date", data.toDate);

    q = q.order("event_date", { ascending: false }).range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      entries: (rows ?? []) as CommercialHistoryEntry[],
      total: count ?? 0,
      page,
      pageSize,
    };
  });

export const getSubscriptionCommercialHistoryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CommercialHistoryFilters & { subscriptionId: string }) => {
    if (!input?.subscriptionId) throw new Error("subscriptionId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<CommercialHistoryResult> => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito");

    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(1000, Math.max(1, data.pageSize ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // super_admin reads via view; RLS on subscription_events/billing_charges
    // already grants super_admin access. Filter by subscription_id explicitly.
    let q = (supabase as any)
      .from("subscription_commercial_history")
      .select("*", { count: "exact" })
      .eq("subscription_id", data.subscriptionId);

    if (data.source && data.source !== "ALL") q = q.eq("source", data.source);
    if (data.fromDate) q = q.gte("event_date", data.fromDate);
    if (data.toDate) q = q.lte("event_date", data.toDate);

    q = q.order("event_date", { ascending: false }).range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      entries: (rows ?? []) as CommercialHistoryEntry[],
      total: count ?? 0,
      page,
      pageSize,
    };
  });
