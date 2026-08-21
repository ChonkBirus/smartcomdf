// Server-only sync helper — used by admin/cron to reconcile a single charge.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncBillingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ charge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: canSync } = await supabase.rpc("has_permission", {
      _slug: "billing.sync_status",
    });
    if (canSync === false) throw new Error("Sem permissão para sincronizar cobranças.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const asaas = await import("@/lib/asaas.server");
    const { applyChargeStatus } = await import("@/lib/billing-webhook.server");

    const { data: charge } = await supabaseAdmin
      .from("billing_charges")
      .select("*")
      .eq("id", data.charge_id)
      .maybeSingle();
    if (!charge || !charge.provider_charge_id) throw new Error("Cobrança não encontrada.");

    const payment = await asaas.asaasGetPayment(charge.provider_charge_id);

    await applyChargeStatus(supabaseAdmin, {
      providerChargeId: payment.id,
      status: payment.status,
      paidAt: (payment as any).paymentDate ?? null,
      raw: payment as any,
    });

    return { ok: true, status: payment.status };
  });
