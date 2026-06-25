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
  original_amount: number;
  discount_amount: number;
  coupon_code: string | null;
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
        coupon_code: z.string().min(1).max(64).optional().nullable(),
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

    const baseAmount =
      data.billing_cycle === "YEARLY"
        ? Number(plan.annual_price)
        : Number(plan.monthly_price);
    if (!baseAmount || baseAmount <= 0)
      throw new Error("Valor de plano inválido.");

    // Validate coupon (if provided)
    let appliedCoupon: {
      id: string;
      code: string;
      discount_amount: number;
      final_amount: number;
    } | null = null;
    if (data.coupon_code) {
      const code = data.coupon_code.trim().toUpperCase();
      const { data: coupon } = await supabase
        .from("billing_coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (!coupon) throw new Error("Cupom inválido ou inativo.");
      const now = new Date();
      if (coupon.valid_from && new Date(coupon.valid_from) > now)
        throw new Error("Cupom ainda não está disponível.");
      if (coupon.valid_until && new Date(coupon.valid_until) < now)
        throw new Error("Cupom expirado.");
      if (
        Array.isArray(coupon.eligible_plan_ids) &&
        coupon.eligible_plan_ids.length > 0 &&
        !coupon.eligible_plan_ids.includes(plan.id)
      )
        throw new Error("Cupom não é válido para este plano.");
      if (
        coupon.max_redemptions != null &&
        coupon.redemption_count >= coupon.max_redemptions
      )
        throw new Error("Cupom esgotado.");
      if (coupon.max_redemptions_per_company != null) {
        const { count } = await supabase
          .from("billing_coupon_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("coupon_id", coupon.id)
          .eq("company_id", companyId);
        if ((count ?? 0) >= coupon.max_redemptions_per_company)
          throw new Error("Sua empresa já utilizou este cupom.");
      }
      const round2 = (v: number) => Math.round(v * 100) / 100;
      const discount =
        coupon.discount_type === "percent"
          ? round2((baseAmount * Number(coupon.discount_value)) / 100)
          : Math.min(round2(Number(coupon.discount_value)), baseAmount);
      const finalAmt = Math.max(round2(baseAmount - discount), 0);
      appliedCoupon = {
        id: coupon.id,
        code: coupon.code,
        discount_amount: discount,
        final_amount: finalAmt,
      };
    }

    const amount = appliedCoupon ? appliedCoupon.final_amount : baseAmount;
    const discountAmount = appliedCoupon?.discount_amount ?? 0;

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
