import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Types
// ============================================================
export type AllocationMethod = "PERCENT_OF_REVENUE" | "FIXED_PER_SALE";

export type CompanyCostSettings = {
  id: string;
  company_id: string;
  monthly_fixed_costs_total: number;
  monthly_operational_costs_total: number;
  expected_monthly_revenue: number | null;
  expected_monthly_sales_count: number | null;
  default_tax_rate: number;
  default_card_fee_rate: number;
  default_commission_rate: number;
  default_warranty_reserve_rate: number;
  default_operational_cost_rate: number;
  default_fixed_cost_allocation_rate: number;
  default_desired_margin_rate: number;
  allocation_method: AllocationMethod;
  created_at: string;
  updated_at: string;
};

export type PricingInput = {
  cost_price: number;
  additional_costs?: number;
  tax_rate?: number;
  card_fee_rate?: number;
  commission_rate?: number;
  warranty_reserve_rate?: number;
  operational_cost_rate?: number;
  fixed_cost_allocation_rate?: number;
  desired_margin_rate?: number;
};

export type PricingResult = {
  ok: boolean;
  reason?: string;
  cost_base: number;
  deductions_total_rate: number;
  deductions_without_margin_rate: number;
  suggested_price: number;
  markup_multiplier: number;
  markup_percentage: number;
  estimated_profit: number;
  estimated_margin_rate: number;
};

// ============================================================
// Helpers
// ============================================================
async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa.");
  return cid;
}

async function hasPerm(supabase: any, slug: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_permission", { _slug: slug });
  if (error) return false;
  return !!data;
}

function n(v: unknown, def = 0): number {
  const x = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(x) ? x : def;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ============================================================
// Core formula — margin-on-sale-price
// ============================================================
export function computeSuggestedPrice(input: PricingInput): PricingResult {
  const cost_base = n(input.cost_price) + n(input.additional_costs);

  const deductions_without_margin_rate =
    n(input.tax_rate) +
    n(input.card_fee_rate) +
    n(input.commission_rate) +
    n(input.warranty_reserve_rate) +
    n(input.operational_cost_rate) +
    n(input.fixed_cost_allocation_rate);

  const desired_margin_rate = n(input.desired_margin_rate);
  const deductions_total_rate = deductions_without_margin_rate + desired_margin_rate;

  const empty: PricingResult = {
    ok: false,
    cost_base,
    deductions_total_rate,
    deductions_without_margin_rate,
    suggested_price: 0,
    markup_multiplier: 0,
    markup_percentage: 0,
    estimated_profit: 0,
    estimated_margin_rate: 0,
  };

  if (cost_base <= 0) {
    return { ...empty, reason: "Informe o preço de custo para calcular." };
  }
  if (deductions_total_rate >= 0.95) {
    return {
      ...empty,
      reason:
        "Os percentuais informados estão muito altos. Revise impostos, taxas, custos e margem desejada para calcular um preço viável.",
    };
  }

  const raw_price = cost_base / (1 - deductions_total_rate);
  if (!Number.isFinite(raw_price) || raw_price <= 0) {
    return { ...empty, reason: "Não foi possível calcular o preço sugerido." };
  }

  const suggested_price = round2(raw_price);
  const deductions_em_reais = suggested_price * deductions_without_margin_rate;
  const estimated_profit = round2(suggested_price - cost_base - deductions_em_reais);
  const estimated_margin_rate = suggested_price > 0 ? estimated_profit / suggested_price : 0;
  const markup_multiplier = suggested_price / cost_base;
  const markup_percentage = (markup_multiplier - 1) * 100;

  return {
    ok: true,
    cost_base,
    deductions_total_rate,
    deductions_without_margin_rate,
    suggested_price,
    markup_multiplier: Math.round(markup_multiplier * 10000) / 10000,
    markup_percentage: Math.round(markup_percentage * 100) / 100,
    estimated_profit,
    estimated_margin_rate: Math.round(estimated_margin_rate * 10000) / 10000,
  };
}

// ============================================================
// Server functions
// ============================================================
export const getCompanyCostSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const canViewCosts = await hasPerm(context.supabase, "finance.view_costs");

    const { data, error } = await context.supabase
      .from("company_cost_settings")
      .select("*")
      .eq("company_id", cid)
      .maybeSingle();
    if (error) throw error;

    if (!data) return { settings: null as CompanyCostSettings | null, canViewCosts };

    // Strip cost totals when user cannot view costs.
    const safe: CompanyCostSettings = { ...(data as CompanyCostSettings) };
    if (!canViewCosts) {
      safe.monthly_fixed_costs_total = 0;
      safe.monthly_operational_costs_total = 0;
      safe.expected_monthly_revenue = null;
      safe.expected_monthly_sales_count = null;
    }
    return { settings: safe, canViewCosts };
  });

const upsertSchema = z.object({
  monthly_fixed_costs_total: z.number().min(0).default(0),
  monthly_operational_costs_total: z.number().min(0).default(0),
  expected_monthly_revenue: z.number().min(0).nullable().optional(),
  expected_monthly_sales_count: z.number().int().min(0).nullable().optional(),
  default_tax_rate: z.number().min(0).max(1).default(0),
  default_card_fee_rate: z.number().min(0).max(1).default(0),
  default_commission_rate: z.number().min(0).max(1).default(0),
  default_warranty_reserve_rate: z.number().min(0).max(1).default(0),
  default_operational_cost_rate: z.number().min(0).max(1).default(0),
  default_fixed_cost_allocation_rate: z.number().min(0).max(1).default(0),
  default_desired_margin_rate: z.number().min(0).max(0.95).default(0.3),
  allocation_method: z.enum(["PERCENT_OF_REVENUE", "FIXED_PER_SALE"]).default("PERCENT_OF_REVENUE"),
});

export const updateCompanyCostSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => upsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    if (!(await hasPerm(context.supabase, "finance.manage_cost_settings"))) {
      throw new Error("Sem permissão para alterar configurações de custos.");
    }
    const payload = { ...data, company_id: cid };
    const { data: row, error } = await context.supabase
      .from("company_cost_settings")
      .upsert(payload, { onConflict: "company_id" })
      .select("*")
      .single();
    if (error) throw error;
    return row as CompanyCostSettings;
  });

const calcSchema = z.object({
  cost_price: z.number(),
  additional_costs: z.number().optional(),
  tax_rate: z.number().optional(),
  card_fee_rate: z.number().optional(),
  commission_rate: z.number().optional(),
  warranty_reserve_rate: z.number().optional(),
  operational_cost_rate: z.number().optional(),
  fixed_cost_allocation_rate: z.number().optional(),
  desired_margin_rate: z.number().optional(),
  use_company_defaults: z.boolean().optional(),
});

export const calculateSuggestedPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => calcSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await hasPerm(context.supabase, "finance.pricing.view"))) {
      throw new Error("Sem permissão para visualizar precificação.");
    }
    const cid = await getCompanyId(context.supabase, context.userId);

    let merged: PricingInput = { ...data };
    let usedDefaults = false;

    if (data.use_company_defaults !== false) {
      const { data: cfg } = await context.supabase
        .from("company_cost_settings")
        .select("*")
        .eq("company_id", cid)
        .maybeSingle();
      if (cfg) {
        usedDefaults = true;
        merged = {
          cost_price: data.cost_price,
          additional_costs: data.additional_costs ?? 0,
          tax_rate: data.tax_rate ?? cfg.default_tax_rate ?? 0,
          card_fee_rate: data.card_fee_rate ?? cfg.default_card_fee_rate ?? 0,
          commission_rate: data.commission_rate ?? cfg.default_commission_rate ?? 0,
          warranty_reserve_rate:
            data.warranty_reserve_rate ?? cfg.default_warranty_reserve_rate ?? 0,
          operational_cost_rate:
            data.operational_cost_rate ?? cfg.default_operational_cost_rate ?? 0,
          fixed_cost_allocation_rate:
            data.fixed_cost_allocation_rate ?? cfg.default_fixed_cost_allocation_rate ?? 0,
          desired_margin_rate:
            data.desired_margin_rate ?? cfg.default_desired_margin_rate ?? 0,
        };
      }
    }

    const result = computeSuggestedPrice(merged);
    return { result, inputs: merged, usedCompanyDefaults: usedDefaults };
  });
