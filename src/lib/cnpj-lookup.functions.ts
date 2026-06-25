import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CnpjLookupResultDTO = {
  cnpj: string;
  corporate_name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  zipcode: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string;
  legal_nature: string | null;
  main_cnae: string | null;
  main_activity: string | null;
  registration_status: string | null;
  opening_date: string | null;
  source: string;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}
function isValidCNPJ(v: string) {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < len; i++) s += parseInt(c[i]) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(c[12]) && calc(13) === parseInt(c[13]);
}

function normalizeBrasilApi(p: any, cnpj: string): CnpjLookupResultDTO {
  return {
    cnpj,
    corporate_name: p.razao_social ?? "",
    trade_name: p.nome_fantasia || null,
    email: p.email || null,
    phone: p.ddd_telefone_1 || null,
    state_registration: null,
    municipal_registration: null,
    zipcode: p.cep ? String(p.cep).replace(/\D/g, "") : null,
    address: p.logradouro || null,
    number: p.numero || null,
    complement: p.complemento || null,
    district: p.bairro || null,
    city: p.municipio || null,
    state: p.uf || null,
    country: "BR",
    legal_nature: p.natureza_juridica || null,
    main_cnae: p.cnae_fiscal ? String(p.cnae_fiscal) : null,
    main_activity: p.cnae_fiscal_descricao || null,
    registration_status: p.descricao_situacao_cadastral || null,
    opening_date: p.data_inicio_atividade || null,
    source: "BRASIL_API",
  };
}

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cnpj: z.string().min(11) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const cnpj = onlyDigits(data.cnpj);

    const { data: profile } = await sb
      .from("profiles")
      .select("id, company_id")
      .eq("id", context.userId)
      .maybeSingle();
    const companyId: string | null = profile?.company_id ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const writeLog = async (
      status: "SUCCESS" | "NOT_FOUND" | "INVALID_CNPJ" | "PROVIDER_ERROR" | "RATE_LIMITED",
      payload: { summary?: any; error?: string } = {},
    ) => {
      try {
        await supabaseAdmin.from("cnpj_lookup_logs").insert({
          company_id: companyId,
          cnpj,
          provider: "BRASIL_API",
          status,
          result_summary: payload.summary ?? null,
          error_message: payload.error ?? null,
          requested_by: context.userId,
        });
      } catch {
        /* ignore log errors */
      }
    };

    if (!isValidCNPJ(cnpj)) {
      await writeLog("INVALID_CNPJ");
      throw new Error("CNPJ inválido. Verifique os números informados.");
    }

    // simple rate-limit: max 20/min per user
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("cnpj_lookup_logs")
      .select("id", { count: "exact", head: true })
      .eq("requested_by", context.userId)
      .gte("created_at", since);
    if ((count ?? 0) > 20) {
      await writeLog("RATE_LIMITED");
      throw new Error("Muitas consultas em pouco tempo. Aguarde alguns instantes e tente novamente.");
    }

    // cache lookup (7 days)
    const { data: cached } = await supabaseAdmin
      .from("cnpj_lookup_cache")
      .select("normalized_data, expires_at")
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (cached && cached.expires_at && new Date(cached.expires_at as string) > new Date()) {
      await writeLog("SUCCESS", { summary: { from_cache: true } });
      return cached.normalized_data as CnpjLookupResultDTO;
    }

    // BrasilAPI
    let resp: Response;
    try {
      resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: { Accept: "application/json" },
      });
    } catch (e: any) {
      await writeLog("PROVIDER_ERROR", { error: e?.message });
      throw new Error("Não foi possível consultar este CNPJ no momento. Preencha os dados manualmente ou tente novamente.");
    }

    if (resp.status === 404) {
      await writeLog("NOT_FOUND");
      throw new Error("CNPJ não encontrado na base consultada. Verifique o número ou preencha manualmente.");
    }
    if (!resp.ok) {
      await writeLog("PROVIDER_ERROR", { error: `HTTP ${resp.status}` });
      throw new Error("Não foi possível consultar este CNPJ no momento. Preencha os dados manualmente ou tente novamente.");
    }

    const raw = await resp.json();
    const normalized = normalizeBrasilApi(raw, cnpj);

    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from("cnpj_lookup_cache").upsert(
      {
        cnpj,
        provider: "BRASIL_API",
        normalized_data: normalized,
        raw_payload: raw,
        fetched_at: new Date().toISOString(),
        expires_at: expires,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cnpj" },
    );

    await writeLog("SUCCESS", { summary: { corporate_name: normalized.corporate_name } });
    return normalized;
  });
