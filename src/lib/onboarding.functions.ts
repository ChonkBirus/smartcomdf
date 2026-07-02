import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"] as const;
export type OnboardingStatus = (typeof STATUS)[number];

export type OnboardingProgress = {
  tour_key: string;
  status: OnboardingStatus;
  current_step: number;
  completed_at: string | null;
  skipped_at: string | null;
};

const tourKeySchema = z.object({ tourKey: z.string().min(1).max(64) });

async function getCompanyId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  return data?.company_id ?? null;
}

export const getOnboardingProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tourKeySchema.parse(d))
  .handler(async ({ data, context }): Promise<OnboardingProgress | null> => {
    const companyId = await getCompanyId(context.supabase, context.userId);
    if (!companyId) return null;
    const { data: row } = await context.supabase
      .from("user_onboarding_progress")
      .select("tour_key,status,current_step,completed_at,skipped_at")
      .eq("user_id", context.userId)
      .eq("company_id", companyId)
      .eq("tour_key", data.tourKey)
      .maybeSingle();
    return (row as OnboardingProgress) ?? null;
  });

export const listOnboardingProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingProgress[]> => {
    const companyId = await getCompanyId(context.supabase, context.userId);
    if (!companyId) return [];
    const { data } = await context.supabase
      .from("user_onboarding_progress")
      .select("tour_key,status,current_step,completed_at,skipped_at")
      .eq("user_id", context.userId)
      .eq("company_id", companyId);
    return (data as OnboardingProgress[]) ?? [];
  });

const upsertSchema = z.object({
  tourKey: z.string().min(1).max(64),
  status: z.enum(STATUS),
  currentStep: z.number().int().min(0).max(100).optional(),
});

export const upsertOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }): Promise<OnboardingProgress | null> => {
    const companyId = await getCompanyId(context.supabase, context.userId);
    if (!companyId) return null;
    const now = new Date().toISOString();
    const payload = {
      user_id: context.userId,
      company_id: companyId,
      tour_key: data.tourKey,
      status: data.status,
      current_step: data.currentStep ?? 0,
      completed_at: data.status === "COMPLETED" ? now : null,
      skipped_at: data.status === "SKIPPED" ? now : null,
    };
    const { data: row, error } = await (context.supabase as any)
      .from("user_onboarding_progress")
      .upsert(payload, { onConflict: "user_id,company_id,tour_key" })
      .select("tour_key,status,current_step,completed_at,skipped_at")
      .single();
    if (error) throw error;
    return row as OnboardingProgress;
  });


export type GettingStartedStatus = {
  hasCustomer: boolean;
  hasProduct: boolean;
  hasCompanyData: boolean;
  hasCrmOpportunity: boolean;
  hasQuote: boolean;
  hasQuotePdf: boolean;
  hasQuoteSent: boolean;
  hasQuoteApproved: boolean;
  hasCrmWon: boolean;
  hasServiceOrder: boolean;
};

export const getGettingStartedStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GettingStartedStatus> => {
    const companyId = await getCompanyId(context.supabase, context.userId);
    const empty: GettingStartedStatus = {
      hasCustomer: false, hasProduct: false, hasCompanyData: false,
      hasCrmOpportunity: false,
      hasQuote: false, hasQuotePdf: false, hasQuoteSent: false,
      hasQuoteApproved: false, hasCrmWon: false, hasServiceOrder: false,
    };
    if (!companyId) return empty;

    const count = async (table: string, filters: Record<string, unknown> = {}) => {
      let q: any = (context.supabase as any).from(table).select("id", { count: "exact", head: true }).eq("company_id", companyId);
      for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
      const { count: c } = await q;
      return (c ?? 0) > 0;
    };


    const [hasCustomer, hasProduct, hasQuote, hasServiceOrder, hasCrmOpportunity, hasCrmWon] = await Promise.all([
      count("customers"),
      count("items"),
      count("quotes"),
      count("service_orders"),
      count("crm_opportunities"),
      count("crm_opportunities", { status: "WON" }),
    ]);

    const { data: company } = await context.supabase
      .from("companies").select("corporate_name,cnpj,phone").eq("id", companyId).maybeSingle();
    const hasCompanyData = Boolean(company?.corporate_name && company?.cnpj && company?.phone);

    const { data: quoteFlags } = await context.supabase
      .from("quotes")
      .select("status,sent_at,accepted_at,pdf_generated_at")
      .eq("company_id", companyId)
      .limit(50);
    const flags = (quoteFlags ?? []) as Array<{ status?: string; sent_at?: string | null; accepted_at?: string | null; pdf_generated_at?: string | null }>;
    const hasQuotePdf = flags.some((q) => !!q.pdf_generated_at);
    const hasQuoteSent = flags.some((q) => !!q.sent_at || ["sent", "viewed", "accepted", "approved"].includes((q.status ?? "").toLowerCase()));
    const hasQuoteApproved = flags.some((q) => !!q.accepted_at || ["accepted", "approved", "won"].includes((q.status ?? "").toLowerCase()));

    return {
      hasCustomer, hasProduct, hasCompanyData,
      hasCrmOpportunity,
      hasQuote, hasQuotePdf, hasQuoteSent, hasQuoteApproved,
      hasCrmWon, hasServiceOrder,
    };
  });

