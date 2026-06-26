import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CnpjProvider = "BRASIL_API" | "CNPJ_WS";
type DebugStep = "provider_fetch" | "validation" | "permission" | "mapper" | "server_function" | "unknown";

export type CnpjLookupDebug = {
  step: DebugStep;
  provider: CnpjProvider | "CACHE" | "NONE";
  status: number;
  message: string;
  endpoint: string;
};

export type CnpjLookupFailureDTO = {
  ok: false;
  code: string;
  userMessage: string;
  debug: CnpjLookupDebug;
};

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

export type CnpjLookupResponseDTO = CnpjLookupResultDTO | CnpjLookupFailureDTO;

export type CnpjLookupDiagnosticDTO = {
  cnpjLimpo: string;
  isValid: boolean;
  provider: CnpjProvider | null;
  status: number | null;
  endpoint: string | null;
  data_normalizada: CnpjLookupResultDTO | null;
  erro_real: string | null;
  debug: CnpjLookupDebug | null;
};

class CnpjLookupError extends Error {
  code: string;
  userMessage: string;
  debug: CnpjLookupDebug;

  constructor(code: string, userMessage: string, debug: CnpjLookupDebug) {
    super(userMessage);
    this.name = "CnpjLookupError";
    this.code = code;
    this.userMessage = userMessage;
    this.debug = debug;
  }
}

const BRASIL_API_ENDPOINT = (cnpj: string) => `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
const CNPJ_WS_ENDPOINT = (cnpj: string) => `https://publica.cnpj.ws/cnpj/${cnpj}`;
const PROVIDER_TIMEOUT_MS = 8000;

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

function safeText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const text = String(v).trim();
  return text.length ? text : null;
}

function safeZip(v: unknown): string | null {
  const digits = onlyDigits(String(v ?? ""));
  return digits.length ? digits : null;
}

function joinPhone(ddd: unknown, phone: unknown) {
  const d = onlyDigits(String(ddd ?? ""));
  const p = onlyDigits(String(phone ?? ""));
  if (!p) return null;
  return d ? `(${d}) ${p}` : p;
}

function normalizeBrasilApi(p: any, cnpj: string): CnpjLookupResultDTO {
  return {
    cnpj,
    corporate_name: safeText(p.razao_social ?? p.legal_name) ?? "",
    trade_name: safeText(p.nome_fantasia ?? p.trade_name),
    email: safeText(p.email),
    phone: safeText(p.ddd_telefone_1 ?? p.phone),
    state_registration: null,
    municipal_registration: null,
    zipcode: safeZip(p.cep ?? p.zip_code),
    address: safeText(p.logradouro ?? p.street),
    number: safeText(p.numero ?? p.number),
    complement: safeText(p.complemento ?? p.complement),
    district: safeText(p.bairro ?? p.neighborhood),
    city: safeText(p.municipio ?? p.city),
    state: safeText(p.uf ?? p.state),
    country: "BR",
    legal_nature: safeText(p.natureza_juridica),
    main_cnae: safeText(p.cnae_fiscal ?? p.cnae),
    main_activity: safeText(p.cnae_fiscal_descricao),
    registration_status: safeText(p.descricao_situacao_cadastral ?? p.situacao_cadastral ?? p.status),
    opening_date: safeText(p.data_inicio_atividade),
    source: "BRASIL_API",
  };
}

function normalizeCnpjWs(p: any, cnpj: string): CnpjLookupResultDTO {
  const est = p?.estabelecimento ?? {};
  const activity = est.atividade_principal ?? {};
  return {
    cnpj,
    corporate_name: safeText(p?.razao_social ?? p?.legal_name) ?? "",
    trade_name: safeText(est.nome_fantasia ?? p?.nome_fantasia ?? p?.trade_name),
    email: safeText(est.email ?? p?.email),
    phone: joinPhone(est.ddd1, est.telefone1) ?? joinPhone(est.ddd2, est.telefone2),
    state_registration: null,
    municipal_registration: null,
    zipcode: safeZip(est.cep ?? p?.cep ?? p?.zip_code),
    address: safeText(est.logradouro ?? p?.logradouro ?? p?.street),
    number: safeText(est.numero ?? p?.numero ?? p?.number),
    complement: safeText(est.complemento ?? p?.complemento ?? p?.complement),
    district: safeText(est.bairro ?? p?.bairro ?? p?.neighborhood),
    city: safeText(est.cidade?.nome ?? est.cidade ?? p?.municipio ?? p?.city),
    state: safeText(est.estado?.sigla ?? est.estado ?? p?.uf ?? p?.state),
    country: "BR",
    legal_nature: safeText(p?.natureza_juridica?.descricao ?? p?.natureza_juridica),
    main_cnae: safeText(activity.id ?? activity.subclasse ?? p?.cnae),
    main_activity: safeText(activity.descricao ?? p?.cnae_fiscal_descricao),
    registration_status: safeText(est.situacao_cadastral ?? p?.situacao_cadastral ?? p?.status),
    opening_date: safeText(est.data_inicio_atividade ?? p?.data_inicio_atividade),
    source: "CNPJ_WS",
  };
}

function normalizeByProvider(provider: CnpjProvider, payload: any, cnpj: string) {
  const normalized = provider === "BRASIL_API"
    ? normalizeBrasilApi(payload, cnpj)
    : normalizeCnpjWs(payload, cnpj);

  if (!normalized.corporate_name) {
    throw new CnpjLookupError("MAPPER_ERROR", "Consulta indisponível no momento. Preencha os dados manualmente ou tente novamente.", {
      step: "mapper",
      provider,
      status: 200,
      message: "Provider returned payload without corporate/legal name.",
      endpoint: provider === "BRASIL_API" ? BRASIL_API_ENDPOINT(cnpj) : CNPJ_WS_ENDPOINT(cnpj),
    });
  }

  return normalized;
}

function userMessageForStatus(status: number) {
  if (status === 400) return "Informe um CNPJ válido.";
  if (status === 404) return "Não encontramos dados para este CNPJ. Você pode preencher manualmente.";
  if (status === 429) return "Limite de consultas atingido. Tente novamente em alguns minutos.";
  return "Consulta indisponível no momento. Preencha os dados manualmente ou tente novamente.";
}

function codeForStatus(status: number) {
  if (status === 400) return "PROVIDER_BAD_REQUEST";
  if (status === 404) return "CNPJ_NOT_FOUND";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_ERROR";
}

function truncateBody(body: string) {
  return body.length > 1600 ? `${body.slice(0, 1600)}…[truncated]` : body;
}

async function fetchProvider(provider: CnpjProvider, cnpj: string, logBody: boolean) {
  const endpoint = provider === "BRASIL_API" ? BRASIL_API_ENDPOINT(cnpj) : CNPJ_WS_ENDPOINT(cnpj);
  console.log("[CNPJ LOOKUP SERVER] provider:", provider);
  console.log("[CNPJ LOOKUP SERVER] endpoint:", endpoint);

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    const responseBody = await response.text();
    console.log("[CNPJ LOOKUP SERVER] status:", response.status);
    console.log("[CNPJ LOOKUP SERVER] body:", logBody ? truncateBody(responseBody) : "[omitted outside development]");

    let json: any = null;
    if (responseBody) {
      try {
        json = JSON.parse(responseBody);
      } catch (parseError: any) {
        return {
          provider,
          endpoint,
          status: response.status,
          ok: false,
          json: null,
          body: responseBody,
          message: `Invalid JSON from provider: ${parseError?.message ?? "unknown"}`,
        };
      }
    }

    return {
      provider,
      endpoint,
      status: response.status,
      ok: response.ok,
      json,
      body: responseBody,
      message: response.ok ? "OK" : `HTTP ${response.status}`,
    };
  } catch (error: any) {
    const isTimeout = error?.name === "TimeoutError" || /timeout/i.test(error?.message ?? "");
    const message = isTimeout
      ? `Timeout after ${PROVIDER_TIMEOUT_MS}ms`
      : `${error?.name ?? "FetchError"}: ${error?.message ?? "unknown"}`;
    console.error("[CNPJ LOOKUP SERVER] provider fetch error:", message);
    return {
      provider,
      endpoint,
      status: 0,
      ok: false,
      json: null,
      body: "",
      message,
      timeout: isTimeout,
    };
  }
}

async function fetchAndNormalizeCnpj(cnpj: string, logBody: boolean) {
  const primary = await fetchProvider("BRASIL_API", cnpj, logBody);

  if (primary.ok) {
    return {
      normalized: normalizeByProvider("BRASIL_API", primary.json, cnpj),
      raw: primary.json,
      provider: "BRASIL_API" as CnpjProvider,
      debug: {
        step: "provider_fetch" as DebugStep,
        provider: "BRASIL_API" as CnpjProvider,
        status: primary.status,
        message: primary.message,
        endpoint: primary.endpoint,
      },
    };
  }

  if (primary.status === 400 || primary.status === 404) {
    throw new CnpjLookupError(codeForStatus(primary.status), userMessageForStatus(primary.status), {
      step: "provider_fetch",
      provider: "BRASIL_API",
      status: primary.status,
      message: primary.message,
      endpoint: primary.endpoint,
    });
  }

  const fallback = await fetchProvider("CNPJ_WS", cnpj, logBody);
  if (fallback.ok) {
    return {
      normalized: normalizeByProvider("CNPJ_WS", fallback.json, cnpj),
      raw: fallback.json,
      provider: "CNPJ_WS" as CnpjProvider,
      debug: {
        step: "provider_fetch" as DebugStep,
        provider: "CNPJ_WS" as CnpjProvider,
        status: fallback.status,
        message: `Fallback succeeded after ${primary.provider} failed with ${primary.message}`,
        endpoint: fallback.endpoint,
      },
    };
  }

  const final = fallback.status ? fallback : primary;
  const status = primary.status === 429 || fallback.status === 429 ? 429 : final.status;
  const timeout = !!primary.timeout || !!fallback.timeout;
  throw new CnpjLookupError(
    timeout ? "PROVIDER_TIMEOUT" : codeForStatus(status),
    timeout ? "Consulta indisponível no momento. Preencha os dados manualmente ou tente novamente." : userMessageForStatus(status),
    {
      step: "provider_fetch",
      provider: final.provider,
      status,
      message: `${primary.provider}: ${primary.message}; ${fallback.provider}: ${fallback.message}`,
      endpoint: final.endpoint,
    },
  );
}

async function assertLookupPermission(sb: any) {
  const permissionSlugs = [
    "customers.lookup_cnpj",
    "clients.lookup_cnpj",
    "customers.create",
    "customers.edit",
    "customers.manage",
    "clients.create",
    "clients.edit",
    "clients.manage",
  ];

  const checks = await Promise.all(
    permissionSlugs.map(async (slug) => {
      const { data, error } = await sb.rpc("has_permission", { _slug: slug });
      if (error) {
        console.error("[CNPJ LOOKUP SERVER] permission check error:", slug, error.message);
        return false;
      }
      return data === true;
    }),
  );

  if (!checks.some(Boolean)) {
    throw new CnpjLookupError("PERMISSION_DENIED", "Você não tem permissão para consultar CNPJ.", {
      step: "permission",
      provider: "NONE",
      status: 403,
      message: `Missing any permission: ${permissionSlugs.join(", ")}`,
      endpoint: "",
    });
  }
}

function toDevFailure(error: unknown): CnpjLookupFailureDTO {
  if (error instanceof CnpjLookupError) {
    return {
      ok: false,
      code: error.code,
      userMessage: error.userMessage,
      debug: error.debug,
    };
  }

  return {
    ok: false,
    code: "UNKNOWN_ERROR",
    userMessage: "Consulta indisponível no momento. Preencha os dados manualmente ou tente novamente.",
    debug: {
      step: "server_function",
      provider: "NONE",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
      endpoint: "",
    },
  };
}

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cnpj: z.string().min(11) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const dev = process.env.NODE_ENV === "development";
    const cnpj = onlyDigits(data.cnpj);
    console.log("[CNPJ LOOKUP SERVER] recebido:", cnpj);

    try {
      const { data: profile, error: profileError } = await sb
        .from("profiles")
        .select("id, company_id")
        .eq("id", context.userId)
        .maybeSingle();
      if (profileError) {
        throw new CnpjLookupError("PERMISSION_PROFILE_ERROR", "Você não tem permissão para consultar CNPJ.", {
          step: "permission",
          provider: "NONE",
          status: 403,
          message: profileError.message,
          endpoint: "",
        });
      }
      const companyId: string | null = profile?.company_id ?? null;

      await assertLookupPermission(sb);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const writeLog = async (
        status: "SUCCESS" | "NOT_FOUND" | "INVALID_CNPJ" | "PROVIDER_ERROR" | "RATE_LIMITED",
        payload: { summary?: any; error?: string; provider?: CnpjProvider | "CACHE" } = {},
      ) => {
        try {
          await supabaseAdmin.from("cnpj_lookup_logs").insert({
            company_id: companyId,
            cnpj,
            provider: payload.provider ?? "BRASIL_API",
            status,
            result_summary: payload.summary ?? null,
            error_message: payload.error ?? null,
            requested_by: context.userId,
          });
        } catch (logError: any) {
          console.error("[CNPJ LOOKUP SERVER] log write failed:", logError?.message ?? logError);
        }
      };

      if (!isValidCNPJ(cnpj)) {
        await writeLog("INVALID_CNPJ");
        throw new CnpjLookupError("INVALID_CNPJ", "Informe um CNPJ válido.", {
          step: "validation",
          provider: "NONE",
          status: 400,
          message: "CNPJ failed local validation: length/check digits/repeated sequence.",
          endpoint: "",
        });
      }

      // simple rate-limit: max 20/min per user
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count, error: rateError } = await supabaseAdmin
        .from("cnpj_lookup_logs")
        .select("id", { count: "exact", head: true })
        .eq("requested_by", context.userId)
        .gte("created_at", since);
      if (rateError) {
        console.error("[CNPJ LOOKUP SERVER] rate-limit check failed:", rateError.message);
      }
      if ((count ?? 0) > 20) {
        await writeLog("RATE_LIMITED");
        throw new CnpjLookupError("LOCAL_RATE_LIMITED", "Limite de consultas atingido. Tente novamente em alguns minutos.", {
          step: "permission",
          provider: "NONE",
          status: 429,
          message: "Local per-user rate limit exceeded: max 20/min.",
          endpoint: "",
        });
      }

      // cache lookup (7 days)
      const { data: cached, error: cacheReadError } = await supabaseAdmin
        .from("cnpj_lookup_cache")
        .select("normalized_data, expires_at")
        .eq("cnpj", cnpj)
        .maybeSingle();
      if (cacheReadError) {
        console.error("[CNPJ LOOKUP SERVER] cache read failed:", cacheReadError.message);
      }
      if (cached && cached.expires_at && new Date(cached.expires_at as string) > new Date()) {
        await writeLog("SUCCESS", { summary: { from_cache: true }, provider: "CACHE" });
        return cached.normalized_data as CnpjLookupResultDTO;
      }

      const { normalized, raw, provider, debug } = await fetchAndNormalizeCnpj(cnpj, dev);
      normalized.source = provider;

      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: cacheWriteError } = await supabaseAdmin.from("cnpj_lookup_cache").upsert(
        {
          cnpj,
          provider,
          normalized_data: normalized,
          raw_payload: raw,
          fetched_at: new Date().toISOString(),
          expires_at: expires,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cnpj" },
      );
      if (cacheWriteError) {
        console.error("[CNPJ LOOKUP SERVER] cache write failed:", cacheWriteError.message);
      }

      await writeLog("SUCCESS", {
        summary: { corporate_name: normalized.corporate_name, provider, status: debug.status },
        provider,
      });
      return normalized;
    } catch (error) {
      console.error("[CNPJ LOOKUP SERVER] erro real:", error);

      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const failure = toDevFailure(error);
        await supabaseAdmin.from("cnpj_lookup_logs").insert({
          company_id: null,
          cnpj,
          provider: failure.debug.provider === "CACHE" || failure.debug.provider === "NONE" ? "BRASIL_API" : failure.debug.provider,
          status: failure.code === "CNPJ_NOT_FOUND" ? "NOT_FOUND" : failure.code === "INVALID_CNPJ" ? "INVALID_CNPJ" : failure.debug.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR",
          result_summary: { debug: failure.debug },
          error_message: failure.debug.message,
          requested_by: context.userId,
        });
      } catch (logError: any) {
        console.error("[CNPJ LOOKUP SERVER] failure log write failed:", logError?.message ?? logError);
      }

      if (dev) {
        return toDevFailure(error);
      }
      if (error instanceof CnpjLookupError) {
        throw new Error(error.userMessage);
      }
      throw new Error("Consulta indisponível no momento. Preencha os dados manualmente ou tente novamente.");
    }
  });

export const testCnpjLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cnpj: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const dev = process.env.NODE_ENV === "development";
    const cnpjLimpo = onlyDigits(data.cnpj);
    console.log("[CNPJ LOOKUP SERVER] testCnpjLookup recebido:", cnpjLimpo);

    if (!isValidCNPJ(cnpjLimpo)) {
      return {
        cnpjLimpo,
        isValid: false,
        provider: null,
        status: null,
        endpoint: null,
        data_normalizada: null,
        erro_real: "Informe um CNPJ válido.",
        debug: {
          step: "validation",
          provider: "NONE",
          status: 400,
          message: "CNPJ failed local validation: length/check digits/repeated sequence.",
          endpoint: "",
        },
      } satisfies CnpjLookupDiagnosticDTO;
    }

    try {
      await assertLookupPermission(sb);
      const { normalized, provider, debug } = await fetchAndNormalizeCnpj(cnpjLimpo, dev);
      return {
        cnpjLimpo,
        isValid: true,
        provider,
        status: debug.status,
        endpoint: debug.endpoint,
        data_normalizada: normalized,
        erro_real: null,
        debug,
      } satisfies CnpjLookupDiagnosticDTO;
    } catch (error) {
      console.error("[CNPJ LOOKUP SERVER] testCnpjLookup erro real:", error);
      const failure = toDevFailure(error);
      return {
        cnpjLimpo,
        isValid: true,
        provider: failure.debug.provider === "CACHE" || failure.debug.provider === "NONE" ? null : failure.debug.provider,
        status: failure.debug.status,
        endpoint: failure.debug.endpoint || null,
        data_normalizada: null,
        erro_real: failure.debug.message,
        debug: failure.debug,
      } satisfies CnpjLookupDiagnosticDTO;
    }
  });
