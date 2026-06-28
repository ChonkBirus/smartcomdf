/**
 * URL base oficial do SmartCom Pro.
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
