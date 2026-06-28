import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRODUCTION_CHECKLIST: { code: string; title: string }[] = [
  { code: "dashboard_no_mocks", title: "Dashboard sem mocks" },
  { code: "customer_registration", title: "Cadastro de cliente validado" },
  { code: "cnpj_lookup", title: "CNPJ lookup validado" },
  { code: "products_services", title: "Produtos e serviços validados" },
  { code: "stock", title: "Estoque validado" },
  { code: "quote_flow", title: "Orçamento validado" },
  { code: "pdf_premium", title: "PDF premium validado" },
  { code: "public_link", title: "Link público validado" },
  { code: "acceptance", title: "Aceite validado" },
  { code: "project", title: "Projeto validado" },
  { code: "service_order_mobile", title: "OS mobile validada" },
  { code: "final_report", title: "Relatório final validado" },
  { code: "reports", title: "Relatórios gerenciais validados" },
  { code: "billing_sandbox", title: "Billing sandbox validado" },
  { code: "billing_production", title: "Billing produção validado" },
  { code: "webhook_production", title: "Webhook produção validado" },
  { code: "coupons", title: "Cupons validados" },
  { code: "multi_company", title: "Multiempresa validado" },
  { code: "permissions", title: "Permissões validadas" },
  { code: "mobile", title: "Mobile validado" },
  { code: "dark_light", title: "Dark/light validado" },
  { code: "landing", title: "Landing page validada" },
  { code: "terms_privacy", title: "Termos e política configurados" },
  { code: "support_whatsapp", title: "WhatsApp de suporte configurado" },
  { code: "pilots_base", title: "Fase 2.14A — Base de Pilotos + Score de Ativação" },
  { code: "pilots_feedback", title: "Fase 2.14B — Detalhe do Piloto + Feedback/Bugs" },
  { code: "pilots_permissions", title: "Fase 2.14C — Permissões e Polimento (UI/RPC/RLS)" },
];

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.company_id) throw new Error("Empresa não encontrada para o usuário.");
  return data.company_id as string;
}

export const getProductionChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);

    // Seed missing items (idempotent).
    const { data: existing } = await supabase
      .from("production_checklist_items")
      .select("code")
      .eq("company_id", companyId);
    const existingCodes = new Set((existing ?? []).map((r: any) => r.code));
    const missing = PRODUCTION_CHECKLIST.filter((i) => !existingCodes.has(i.code));
    if (missing.length > 0) {
      await supabase.from("production_checklist_items").insert(
        missing.map((i) => ({ company_id: companyId, code: i.code, title: i.title })),
      );
    }

    const { data: rows, error } = await supabase
      .from("production_checklist_items")
      .select("id, code, title, status, note, responsible, completed_at, updated_at")
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);

    const order = new Map(PRODUCTION_CHECKLIST.map((i, idx) => [i.code, idx]));
    const sorted = (rows ?? []).slice().sort(
      (a: any, b: any) => (order.get(a.code) ?? 999) - (order.get(b.code) ?? 999),
    );
    const done = sorted.filter((r: any) => r.status === "done").length;
    return { items: sorted, total: sorted.length, done };
  });

export const updateProductionChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "done"]).optional(),
        note: z.string().max(2000).nullable().optional(),
        responsible: z.string().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: {
      status?: "pending" | "done";
      completed_at?: string | null;
      note?: string | null;
      responsible?: string | null;
    } = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.completed_at = data.status === "done" ? new Date().toISOString() : null;
    }
    if (data.note !== undefined) patch.note = data.note;
    if (data.responsible !== undefined) patch.responsible = data.responsible;

    const { error } = await supabase
      .from("production_checklist_items")
      .update(patch)
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
