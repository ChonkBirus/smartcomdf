/**
 * Rate limit persistente (P0-07).
 *
 * A tabela `public.public_rate_limits` + RPC `try_consume_rate_limit`
 * mantêm contadores globais entre instâncias/edge do Cloudflare Worker.
 * A chave (`bucket`) é sempre um HMAC-SHA256 do identificador sensível
 * (token, e-mail, IP...) usando `RATE_LIMIT_HASH_SECRET` — nunca gravamos
 * o valor em claro.
 *
 * Comportamento em falha depende do chamador (fail-open vs fail-closed).
 */

// HMAC via Web Crypto (nativo no runtime Cloudflare Workers/edge). Evita
// depender de `node:crypto`, que exige nodejs_compat e já causou falha de
// carregamento do worker em ambiente de preview.

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export type RateLimitOutcome = RateLimitResult & { failed: boolean };

/** Pega o IP do request de forma tolerante (edge/proxies). */
export function clientIp(request: Request): string {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("fly-client-ip") ||
    "unknown"
  );
}

function getHashSecret(): string | null {
  const s = process.env.RATE_LIMIT_HASH_SECRET;
  if (s && s.length >= 16) return s;
  return null;
}

/**
 * Deriva uma chave-bucket estável e não reversível.
 * `namespace` identifica o endpoint/dimensão (ex.: "qimg:tokip").
 * `parts` são os identificadores sensíveis já normalizados.
 */
export async function hashBucket(namespace: string, ...parts: string[]): Promise<string> {
  const secret = getHashSecret();
  const payload = parts.join("|");
  if (!secret) {
    // Fallback explícito (não-secreto) apenas em dev.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[rate-limit] RATE_LIMIT_HASH_SECRET ausente — usando fallback de dev.",
      );
      return `${namespace}:dev:${payload}`;
    }
    // Em produção retornamos string vazia; try_consume_rate_limit
    // vai retornar allowed=false e o caller cuida do fail-closed.
    return "";
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${namespace}|${payload}`));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
  return `${namespace}:${hex}`;
}

/**
 * Consome 1 unidade do bucket. Chamado exclusivamente server-side.
 * `bucket` deve vir de `hashBucket(...)`.
 */
export async function tryConsumeRateLimit(
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitOutcome> {
  if (!bucket) {
    // secret ausente em produção — fail-closed sinalizado com failed=true.
    return { ok: false, remaining: 0, retryAfterSec: windowSec, failed: true };
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("try_consume_rate_limit", {
      _bucket: bucket,
      _limit: limit,
      _window_seconds: windowSec,
    } as any);
    if (error) {
      console.error("[rate-limit] RPC error", error.message);
      return { ok: false, remaining: 0, retryAfterSec: windowSec, failed: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { ok: false, remaining: 0, retryAfterSec: windowSec, failed: true };
    }
    return {
      ok: Boolean(row.allowed),
      remaining: Number(row.remaining ?? 0),
      retryAfterSec: Number(row.retry_after_sec ?? windowSec),
      failed: false,
    };
  } catch (e: any) {
    console.error("[rate-limit] exception", e?.message ?? e);
    return { ok: false, remaining: 0, retryAfterSec: windowSec, failed: true };
  }
}

/** Normaliza e-mail para uso no hash (lowercase + trim). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
