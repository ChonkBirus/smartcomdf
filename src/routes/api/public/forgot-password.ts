import { createFileRoute } from "@tanstack/react-router";

// Público: proxy server-side para o fluxo "esqueci minha senha".
// Aplica rate limit persistente (P0-07) ANTES de acionar o envio do e-mail
// do Supabase. A resposta pública é sempre 200 genérico — nunca revela se
// o e-mail existe, nem se foi bloqueado.
//
// Rate limit:
//   - 3 tentativas / 15 min por email+IP
//   - 10 tentativas / 15 min por IP
// Fail-closed internamente (não envia e-mail), mas UI/resposta continuam 200.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const OK = new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { "Content-Type": "application/json", ...CORS },
});

function ok() {
  return OK.clone();
}

export const Route = createFileRoute("/api/public/forgot-password")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const { tryConsumeRateLimit, hashBucket, clientIp, normalizeEmail } =
          await import("@/lib/rate-limit.server");

        const ip = clientIp(request);

        let body: any;
        try {
          body = await request.json();
        } catch {
          return ok();
        }

        const rawEmail = String(body?.email ?? "");
        const redirectTo = String(body?.redirectTo ?? "");
        const emailNorm = normalizeEmail(rawEmail);
        const emailValid =
          emailNorm.length > 0 &&
          emailNorm.length <= 255 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);

        // Sempre retornamos 200 genérico. Se o e-mail é inválido, apenas não
        // acionamos o envio — nem tocamos no rate limit para não permitir que
        // um atacante consuma buckets alheios com lixo.
        if (!emailValid) return ok();

        // Rate limit por IP.
        const rlIp = await tryConsumeRateLimit(hashBucket("fpw:ip", ip), 10, 900);
        if (rlIp.failed || !rlIp.ok) return ok();

        // Rate limit por email+IP.
        const rlEmail = await tryConsumeRateLimit(
          hashBucket("fpw:emailip", emailNorm, ip),
          3,
          900,
        );
        if (rlEmail.failed || !rlEmail.ok) return ok();

        // Dispara o envio do e-mail pelo Supabase Auth usando a chave
        // publishable (mesma coisa que o browser faria).
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const client = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
              global: {
                fetch: (input, init) => {
                  const h = new Headers(init?.headers);
                  if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                    h.delete("Authorization");
                  }
                  h.set("apikey", key);
                  return fetch(input, { ...init, headers: h });
                },
              },
            });
            await client.auth.resetPasswordForEmail(emailNorm, {
              redirectTo: redirectTo || undefined,
            });
          }
        } catch (e: any) {
          // Log apenas server-side; nunca vaza para o cliente.
          console.warn("[forgot-password] send error", e?.message ?? e);
        }

        return ok();
      },
    },
  },
});
