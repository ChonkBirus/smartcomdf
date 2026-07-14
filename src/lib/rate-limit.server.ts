/**
 * Rate limiter in-memory (por instância do worker).
 *
 * Limitação conhecida: não é global entre instâncias / edge regions.
 * Serve como proteção de "primeira camada" contra abuso trivial em
 * rotas públicas (upload de comprovante, listagem de imagens, reset
 * de senha). Um limitador persistente exigiria migration/tabela e
 * ficou fora deste PR por decisão explícita do usuário.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

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
