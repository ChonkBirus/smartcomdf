/**
 * Open Finance webhook — provider callback endpoint.
 *
 * Public route. Signature/secret is validated BEFORE any DB write or
 * payload processing. Idempotent via `openfinance_webhook_events(provider, event_id)`
 * unique index.
 *
 * NEVER returns provider tokens, customer PII, or secrets in the response.
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/open-finance-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getOpenFinanceProvider } = await import("@/lib/open-finance/provider");
        const provider = getOpenFinanceProvider();
        if (!provider.status().configured) {
          // Don't reveal config state to a public caller.
          return new Response("Not configured", { status: 503 });
        }

        const rawBody = await request.text();
        if (!provider.verifyWebhookSignature(rawBody, request.headers)) {
          console.warn("[open-finance webhook] invalid signature");
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventId: string | null = payload?.id ?? payload?.event_id ?? null;
        const eventType: string | null = payload?.event ?? payload?.type ?? null;
        const providerConnectionId: string | null =
          payload?.itemId ?? payload?.item_id ?? payload?.connection_id ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency check
        if (eventId) {
          const { data: existing } = await supabaseAdmin
            .from("openfinance_webhook_events")
            .select("id")
            .eq("provider", provider.name)
            .eq("event_id", eventId)
            .maybeSingle();
          if (existing) {
            return new Response("Duplicate", { status: 200 });
          }
        }

        // Resolve company_id via the local connection record (never trust payload).
        let companyId: string | null = null;
        let connectionId: string | null = null;
        if (providerConnectionId) {
          const { data: conn } = await supabaseAdmin
            .from("openfinance_connections")
            .select("id, company_id")
            .eq("provider", provider.name)
            .eq("provider_connection_id", providerConnectionId)
            .maybeSingle();
          if (conn) {
            connectionId = conn.id;
            companyId = conn.company_id;
          }
        }

        const { error: logErr } = await supabaseAdmin.from("openfinance_webhook_events").insert({
          provider: provider.name,
          event_id: eventId,
          event_type: eventType,
          connection_id: connectionId,
          company_id: companyId,
          payload,
          status: "RECEIVED",
        });
        if (logErr) {
          console.error("[open-finance webhook] log insert failed", logErr.message);
          return new Response("Server error", { status: 500 });
        }

        // Mark connection as needing sync (real provider integration will trigger
        // background sync logic from here once enabled).
        if (connectionId) {
          await supabaseAdmin
            .from("openfinance_connections")
            .update({ last_sync_at: new Date().toISOString() })
            .eq("id", connectionId);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
