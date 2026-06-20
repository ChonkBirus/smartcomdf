import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns current user's profile, company and roles
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*, companies(*)")
      .eq("id", userId)
      .maybeSingle();

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userId);

    return {
      profile,
      company: profile?.companies ?? null,
      roles: roles ?? [],
      isSuperAdmin: (roles ?? []).some((r) => r.role === "super_admin"),
      isOwner: (roles ?? []).some((r) => r.role === "owner"),
    };
  });

// Creates a new company + sets caller as owner. Called after first signup.
const createCompanySchema = z.object({
  corporate_name: z.string().trim().min(2).max(150),
  trade_name: z.string().trim().max(150).optional(),
  cnpj: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(20).optional(),
  plan_slug: z.enum(["starter", "pro", "business"]).default("starter"),
});

export const createCompanyForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createCompanySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Block if user already belongs to a company
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (existing?.company_id) throw new Error("Usuário já vinculado a uma empresa.");

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("slug", data.plan_slug)
      .maybeSingle();
    if (!plan) throw new Error("Plano inválido.");

    const { data: company, error: cErr } = await supabaseAdmin
      .from("companies")
      .insert({
        corporate_name: data.corporate_name,
        trade_name: data.trade_name ?? null,
        cnpj: data.cnpj ?? null,
        phone: data.phone ?? null,
        plan_id: plan.id,
        status: "trial",
      })
      .select()
      .single();
    if (cErr || !company) throw new Error(cErr?.message ?? "Falha ao criar empresa.");

    await supabaseAdmin.from("profiles").update({ company_id: company.id }).eq("id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, company_id: company.id, role: "owner" });
    await supabaseAdmin.from("settings").insert({ company_id: company.id });
    await supabaseAdmin.from("subscriptions").insert({
      company_id: company.id,
      plan_id: plan.id,
      trial: true,
      expiration_date: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    });

    return { company_id: company.id };
  });
