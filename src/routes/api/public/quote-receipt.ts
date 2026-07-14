import { createFileRoute } from "@tanstack/react-router";

// Público: cliente envia comprovante de pagamento pelo link do orçamento.
// Fluxo: valida input → chama RPC submit_public_quote_receipt (cria pagamento
// aguardando revisão + retorna upload_path) → faz upload no bucket privado
// com supabaseAdmin → em caso de falha no upload chama rollback_public_quote_receipt.
// NUNCA aprova pagamento nem toca no financeiro.

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

export const Route = createFileRoute("/api/public/quote-receipt")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const { rateLimit, clientIp } = await import("@/lib/rate-limit.server");
        const ip = clientIp(request);
        // Rate limit por IP antes de qualquer parsing pesado: 20 uploads / 10 min.
        const rlIp = rateLimit(`qrec:ip:${ip}`, 20, 600);
        if (!rlIp.ok) {
          return new Response(
            JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }),
            { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rlIp.retryAfterSec), ...CORS } },
          );
        }
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Formato inválido." }, 400);
        }

        const token = String(form.get("token") ?? "").trim();
        const amount = Number(form.get("amount") ?? 0);
        const payerName = String(form.get("payer_name") ?? "").trim();
        const paymentDate = String(form.get("payment_date") ?? "").trim();
        const paymentMethod = String(form.get("payment_method") ?? "PIX").trim();
        const file = form.get("file");

        // Rate limit adicional por token: 10 uploads / 10 min por orçamento.
        if (/^[0-9a-f-]{36}$/i.test(token)) {
          const rlTok = rateLimit(`qrec:tok:${token}`, 10, 600);
          if (!rlTok.ok) {
            return new Response(
              JSON.stringify({ error: "Muitas tentativas para este orçamento. Aguarde alguns minutos." }),
              { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rlTok.retryAfterSec), ...CORS } },
            );
          }
        }


        if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "Token inválido." }, 400);
        if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Valor inválido." }, 400);
        if (!paymentDate || Number.isNaN(Date.parse(paymentDate))) {
          return json({ error: "Data inválida." }, 400);
        }
        if (!(file instanceof File)) return json({ error: "Arquivo obrigatório." }, 400);
        if (!ALLOWED_MIME.has(file.type)) {
          return json({ error: "Tipo de arquivo não suportado (use PDF, JPG, PNG ou WEBP)." }, 400);
        }
        if (file.size <= 0 || file.size > MAX_SIZE) {
          return json({ error: "Arquivo excede o limite de 10 MB." }, 400);
        }
        const ext = EXT_BY_MIME[file.type];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) cria o pagamento + reserva o path
        const { data: created, error: rpcErr } = await supabaseAdmin.rpc(
          "submit_public_quote_receipt",
          {
            _token: token,
            _amount: amount,
            _payer_name: payerName || null,
            _payment_date: paymentDate,
            _payment_method: paymentMethod || "PIX",
            _mime: file.type,
            _size: file.size,
            _ext: ext,
          } as any,
        );
        if (rpcErr) return json({ error: rpcErr.message }, 400);
        const row = Array.isArray(created) ? created[0] : created;
        const paymentId = row?.payment_id as string | undefined;
        const uploadPath = row?.upload_path as string | undefined;
        if (!paymentId || !uploadPath) return json({ error: "Falha ao registrar pagamento." }, 500);

        // 2) upload no bucket privado
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { error: upErr } = await supabaseAdmin.storage
          .from("payment-receipts")
          .upload(uploadPath, bytes, {
            contentType: file.type,
            upsert: false,
          });

        if (upErr) {
          // rollback: remove o pagamento pendente para não ficar apontando pra arquivo inexistente
          await supabaseAdmin.rpc("rollback_public_quote_receipt", { _payment_id: paymentId } as any);
          return json({ error: "Falha ao enviar o arquivo. Tente novamente." }, 500);
        }

        return json({ ok: true, payment_id: paymentId });
      },
    },
  },
});
