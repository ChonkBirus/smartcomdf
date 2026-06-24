// Authenticated server functions to start a checkout for a plan.
// Pix and Boleto: returns inline QR / barcode data + invoice URL.
// Credit card: returns the Asaas hosted invoiceUrl — we never collect card data.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PaymentMethodSchema = z.enum(["PIX", "BOLETO", "CREDIT_CARD"]);
const BillingCycleSchema = z.enum(["MONTHLY", "YEARLY"]);

export type CheckoutSessionResult = {
  session_id: string;
  charge_id: string;
  provider: "ASAAS";
  payment_method: "PIX" | "BOLETO" | "CREDIT_CARD";
  amount: number;
  due_date: string;
  status: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code_base64: string | null;
  pix_copy_paste: string | null;
};

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan_slug: z.enum(["starter", "pro", "business"]),
        billing_cycle: BillingCycleSchema,
        payment_method: PaymentMethodSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    const { supabase, userId } = context;

    // Resolve company + permission
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("Empresa não encontrada.");

    const { data: canCheckout } = await supabase.rpc("has_permission", {
      _slug: "billing.checkout",
    });
    if (canCheckout === false) throw new Error("Sem permissão para iniciar checkout.");

    // Plan
    const { data: plan } = await supabase
      .from("plans")
      .select("id, slug, name, monthly_price, annual_price")
      .eq("slug", data.plan_slug)
      .eq("active", true)
      .maybeSingle();
    if (!plan) throw new Error("Plano não encontrado.");

    const amount =
      data.billing_cycle === "YEARLY"
        ? Number(plan.annual_price)
        : Number(plan.monthly_price);
    if (!amount || amount <= 0) throw new Error("Valor de plano inválido.");

    // Company + current subscription (optional link)
    const { data: company } = await supabase
      .from("companies")
      .select("id, corporate_name, trade_name, cnpj, email, phone, whatsapp")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) throw new Error("Empresa não encontrada.");

    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Admin client + Asaas adapter — server-only imports
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const asaas = await import("@/lib/asaas.server");

    // Ensure billing_customers row + Asaas customer
    const { data: existingBc } = await supabaseAdmin
      .from("billing_customers")
      .select("*")
      .eq("company_id", companyId)
      .eq("provider", "ASAAS")
      .maybeSingle();

    let providerCustomerId = existingBc?.provider_customer_id ?? null;

    if (!providerCustomerId) {
      // Try to find existing in Asaas by externalReference (companyId)
      const found = await asaas
        .asaasFindCustomerByExternalRef(companyId)
        .catch(() => null);
      const asaasCust =
        found ??
        (await asaas.asaasCreateCustomer({
          name: company.corporate_name || company.trade_name || "Cliente",
          cpfCnpj: company.cnpj?.replace(/\D/g, "") || undefined,
          email: company.email || profile?.email || undefined,
          mobilePhone:
            (company.whatsapp || company.phone || "").replace(/\D/g, "") ||
            undefined,
          externalReference: companyId,
        }));
      providerCustomerId = asaasCust.id;

      if (existingBc) {
        await supabaseAdmin
          .from("billing_customers")
          .update({
            provider_customer_id: providerCustomerId,
            name: asaasCust.name,
            email: asaasCust.email,
            cpf_cnpj: asaasCust.cpfCnpj,
          })
          .eq("id", existingBc.id);
      } else {
        await supabaseAdmin.from("billing_customers").insert({
          company_id: companyId,
          provider: "ASAAS",
          provider_customer_id: providerCustomerId,
          name: asaasCust.name,
          email: asaasCust.email,
          cpf_cnpj: asaasCust.cpfCnpj,
          phone: company.phone,
          mobile_phone: company.whatsapp || company.phone,
        });
      }
    }

    // Create Asaas payment (1 cycle). For YEARLY we charge the full annual_price.
    const dueDate = addDaysIso(data.payment_method === "BOLETO" ? 3 : 1);
    const description = `Assinatura ${plan.name} (${data.billing_cycle === "YEARLY" ? "anual" : "mensal"})`;

    const payment = await asaas.asaasCreatePayment({
      customer: providerCustomerId!,
      billingType: data.payment_method,
      value: Number(amount.toFixed(2)),
      dueDate,
      description,
      externalReference: `${companyId}:${plan.id}:${data.billing_cycle}`,
    });

    let pixQr: { encodedImage: string; payload: string } | null = null;
    if (data.payment_method === "PIX") {
      try {
        const qr = await asaas.asaasGetPixQrCode(payment.id);
        pixQr = { encodedImage: qr.encodedImage, payload: qr.payload };
      } catch (e) {
        console.error("[checkout] pix qr fetch failed", e);
      }
    }

    // Persist checkout session + charge
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("billing_checkout_sessions")
      .insert({
        company_id: companyId,
        plan_id: plan.id,
        subscription_id: currentSub?.id ?? null,
        provider: "ASAAS",
        provider_checkout_id: payment.id,
        status: "PENDING",
        amount,
        billing_cycle: data.billing_cycle,
        payment_method: data.payment_method,
        checkout_url: payment.invoiceUrl,
        created_by: userId,
        expires_at: null,
      })
      .select("id")
      .single();
    if (sessErr) throw new Error(sessErr.message);

    const { data: charge, error: chargeErr } = await supabaseAdmin
      .from("billing_charges")
      .insert({
        company_id: companyId,
        subscription_id: currentSub?.id ?? null,
        plan_id: plan.id,
        provider: "ASAAS",
        provider_charge_id: payment.id,
        status: payment.status,
        amount,
        billing_cycle: data.billing_cycle,
        payment_method: data.payment_method,
        due_date: payment.dueDate,
        invoice_url: payment.invoiceUrl,
        bank_slip_url: payment.bankSlipUrl,
        checkout_url: payment.invoiceUrl,
        pix_qr_code: pixQr?.encodedImage ?? null,
        pix_copy_paste: pixQr?.payload ?? null,
        raw_payload: payment as any,
      })
      .select("id")
      .single();
    if (chargeErr) throw new Error(chargeErr.message);

    return {
      session_id: session.id,
      charge_id: charge.id,
      provider: "ASAAS",
      payment_method: data.payment_method,
      amount,
      due_date: payment.dueDate,
      status: payment.status,
      invoice_url: payment.invoiceUrl,
      bank_slip_url: payment.bankSlipUrl,
      pix_qr_code_base64: pixQr?.encodedImage ?? null,
      pix_copy_paste: pixQr?.payload ?? null,
    };
  });
