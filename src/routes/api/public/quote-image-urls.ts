import { createFileRoute } from "@tanstack/react-router";

// Público: dado um token de orçamento e uma lista de image_paths do bucket
// product-images, valida que cada path realmente pertence ao orçamento e
// devolve signed URLs curtas (1h). Nunca lista o bucket, nunca expõe
// imagens de outra empresa.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/quote-image-urls")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Formato inválido." }, 400);
        }
        const token = String(body?.token ?? "").trim();
        const rawPaths: unknown = body?.paths;
        if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "Token inválido." }, 400);
        if (!Array.isArray(rawPaths)) return json({ error: "paths inválido." }, 400);
        const paths = Array.from(
          new Set(
            rawPaths
              .filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= 500)
              .slice(0, 200),
          ),
        );
        if (paths.length === 0) return json({ urls: {} });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Valida que cada path pertence ao orçamento identificado por _token
        const { data: valid, error: vErr } = await supabaseAdmin.rpc(
          "validate_public_quote_image_paths",
          { _token: token, _paths: paths } as any,
        );
        if (vErr) return json({ error: vErr.message }, 400);
        const validPaths = new Set<string>(((valid as string[]) ?? []));
        const urls: Record<string, string> = {};
        for (const p of paths) {
          if (!validPaths.has(p)) continue;
          const { data: signed } = await supabaseAdmin.storage
            .from("product-images")
            .createSignedUrl(p, 60 * 60);
          if (signed?.signedUrl) urls[p] = signed.signedUrl;
        }
        return json({ urls });
      },
    },
  },
});
