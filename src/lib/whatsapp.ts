/**
 * Centralized helper to build wa.me URLs for customer WhatsApp.
 * Always opens WhatsApp externally (never api.whatsapp.com inside iframe).
 */

export type WhatsAppUrlResult =
  | { ok: true; url: string; normalizedPhone: string }
  | { ok: false; reason: "missing" | "invalid"; message: string };

/** Normaliza telefone brasileiro para formato 55DDDNUMERO. */
export function normalizeBrazilianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // Se já vier com DDI 55 e 12-13 dígitos → ok
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // 10 (fixo) ou 11 (celular) dígitos → prefixar 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return null;
}

export function buildCustomerWhatsAppUrl(
  customerPhone: string | null | undefined,
  message: string,
): WhatsAppUrlResult {
  const rawTrimmed = (customerPhone ?? "").toString().trim();
  if (!rawTrimmed) {
    return {
      ok: false,
      reason: "missing",
      message: "Este cliente não possui WhatsApp cadastrado.",
    };
  }
  const normalized = normalizeBrazilianPhone(rawTrimmed);
  if (!normalized) {
    return {
      ok: false,
      reason: "invalid",
      message: "WhatsApp do cliente inválido. Atualize o cadastro do cliente.",
    };
  }
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  return { ok: true, url, normalizedPhone: normalized };
}

import { publicShareUrl } from "./app-url";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type QuoteWaInput = {
  quote: {
    quote_number: string;
    title?: string | null;
    total_amount: number;
    valid_until?: string | null;
    completion_estimate?: string | null;
    public_token: string;
  };
  customer?: { name?: string | null; trade_name?: string | null } | null;
};

/** Mensagem padrão do WhatsApp para envio da proposta (inclui link público oficial). */
export function buildQuoteWhatsAppMessage({ quote, customer }: QuoteWaInput): string {
  const url = publicShareUrl(`/q/${quote.public_token}`);
  const who = customer?.trade_name || customer?.name;
  const lines = [
    `Olá${who ? `, ${who}` : ""}!`,
    "",
    `Segue o orçamento *${quote.quote_number}* para sua avaliação.`,
    quote.title ? `Referente a: ${quote.title}` : "",
    "",
    `*Valor Total da Proposta: ${fmtBRL(quote.total_amount)}*`,
    `_Materiais, serviços e mão de obra inclusos._`,
    quote.valid_until
      ? `Validade da proposta: ${new Date(quote.valid_until).toLocaleDateString("pt-BR")}`
      : "",
    quote.completion_estimate ? `Estimativa de conclusão: ${quote.completion_estimate}` : "",
    "",
    "Você pode visualizar e aceitar diretamente neste link:",
    url,
    "",
    "Qualquer dúvida estou à disposição.",
  ].filter(Boolean);
  return lines.join("\n");
}

export type QuotePixWaInput = {
  quote: {
    quote_number: string;
    total_amount: number;
    remaining_amount: number;
    down_payment_percent?: number | null;
    public_token: string;
  };
  customer?: { name?: string | null; trade_name?: string | null } | null;
  payment: { amount: number; pix_key?: string | null; pix_copy_paste?: string | null };
  companyPixKey?: string | null;
};

/** Mensagem padrão do Pix da entrada (inclui link público oficial da proposta). */
export function buildQuotePixWhatsAppMessage({
  quote,
  customer,
  payment,
  companyPixKey,
}: QuotePixWaInput): string {
  const url = publicShareUrl(`/q/${quote.public_token}`);
  const who = customer?.trade_name || customer?.name || "cliente";
  const pixKey = payment.pix_key || companyPixKey || "";
  const lines = [
    `Olá, ${who}! Tudo bem?`,
    "",
    `Seu orçamento *${quote.quote_number}* foi aprovado.`,
    "",
    `Para iniciarmos o serviço, segue o Pix referente à entrada${
      quote.down_payment_percent ? ` de ${quote.down_payment_percent}%` : ""
    }:`,
    `*Valor da entrada: ${fmtBRL(Number(payment.amount))}*`,
    "",
    pixKey ? `Chave Pix: ${pixKey}` : "",
    payment.pix_copy_paste ? `Pix Copia e Cola:\n${payment.pix_copy_paste}` : "",
    "",
    "Após o pagamento, envie o comprovante por aqui.",
    "",
    `Valor total da proposta: ${fmtBRL(quote.total_amount)}`,
    `Saldo restante: ${fmtBRL(quote.remaining_amount)}`,
    `Link da proposta: ${url}`,
    "",
    "Obrigado!",
  ].filter(Boolean);
  return lines.join("\n");
}
