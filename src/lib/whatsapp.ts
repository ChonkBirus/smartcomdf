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
