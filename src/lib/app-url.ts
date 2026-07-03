/**
 * URL base oficial do SmartPro.
 * Em runtime no browser usa `window.location.origin` (cobre app.smartcomdf.com.br
 * e o domínio Lovable como fallback). Em SSR usa a constante abaixo.
 */
export const APP_BASE_URL = "https://app.smartcomdf.com.br";
export const APP_FALLBACK_URL = "https://smartcompro.lovable.app";

export function appBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return APP_BASE_URL;
}

export function appUrl(path = "/"): string {
  const base = appBaseUrl().replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * URL pública canônica (para links compartilhados com clientes: WhatsApp,
 * e-mail, PDF). Sempre usa o domínio oficial APP_BASE_URL, mesmo quando
 * o app está rodando em preview do Lovable.
 */
export function publicShareUrl(path = "/"): string {
  const base = APP_BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

