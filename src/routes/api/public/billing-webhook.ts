// Public webhook endpoint for Asaas. NO JWT required.
// Security: validates `asaas-access-token` header against ASAAS_WEBHOOK_SECRET
// with timingSafeEqual BEFORE any DB write or payload processing.

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

function tokensMatch(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/billing-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_WEBHOOK_SECRET;
        if (!expected) {
          console.error("[billing-webhook] ASAAS_WEBHOOK_SECRET not set");
          return new Response("Server not configured", { status: 500 });
        }

        const token = request.headers.get("asaas-access-token");
        if (!tokensMatch(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const rawBody = await request.text();
        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType: string = payload?.event ?? "UNKNOWN";
        const eventId: string | null = payload?.id ?? null;
        const payment = payload?.payment ?? null;
        const providerObjectId: string | null = payment?.id ?? null;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Idempotency: by event id when available
        if (eventId) {
          const { data: existing } = await supabaseAdmin
            .from("billing_webhook_events")
            .select("id, status")
            .eq("provider", "ASAAS")
            .eq("event_id", eventId)
            .maybeSingle();
          if (existing && existing.status === "PROCESSED") {
            return Response.json({ ok: true, deduped: true });
          }
        }

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("billing_webhook_events")
          .insert({
            provider: "ASAAS",
            event_id: eventId,
            event_type: eventType,
            provider_object_id: providerObjectId,
            payload: payload as any,
            status: "RECEIVED",
          })
          .select("id")
          .single();
        if (insertErr) {
          console.error("[billing-webhook] insert event failed", insertErr);
          return new Response("Storage error", { status: 500 });
        }

        try {
          if (payment?.id) {
            const { applyChargeStatus } = await import(
              "@/lib/billing-webhook.server"
            );
            await applyChargeStatus(supabaseAdmin, {
              providerChargeId: payment.id,
              status: payment.status,
              paidAt:
                payment.paymentDate ??
                payment.clientPaymentDate ??
                payment.confirmedDate ??
                null,
              raw: payment,
            });
          }

          await supabaseAdmin
            .from("billing_webhook_events")
            .update({
              status: "PROCESSED",
              processed_at: new Date().toISOString(),
            })
            .eq("id", inserted.id);
        } catch (e: any) {
          console.error("[billing-webhook] process failed", e);
          await supabaseAdmin
            .from("billing_webhook_events")
            .update({
              status: "ERROR",
              error_message: String(e?.message ?? e),
            })
            .eq("id", inserted.id);
          return new Response("Processing error", { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
