/**
 * Reusable address (CEP) lookup helpers.
 * Tries ViaCEP first; falls back to BrasilAPI. No secrets; safe in browser.
 */

export type CepResult = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
  complement?: string;
  ibge?: string;
};

const TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export function onlyDigitsCep(v: string): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 8);
}

export function maskCep(v: string): string {
  const d = onlyDigitsCep(v);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export async function lookupCep(rawCep: string): Promise<CepResult | null> {
  const cep = onlyDigitsCep(rawCep);
  if (cep.length !== 8) return null;

  // 1) ViaCEP
  try {
    const r = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`);
    if (r.ok) {
      const j: any = await r.json();
      if (j && !j.erro) {
        return {
          cep,
          street: j.logradouro ?? "",
          district: j.bairro ?? "",
          city: j.localidade ?? "",
          state: (j.uf ?? "").toUpperCase(),
          complement: j.complemento ?? "",
          ibge: j.ibge ?? undefined,
        };
      }
    }
  } catch {
    /* fallthrough to fallback */
  }

  // 2) BrasilAPI fallback
  try {
    const r = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (r.ok) {
      const j: any = await r.json();
      if (j && j.cep) {
        return {
          cep,
          street: j.street ?? "",
          district: j.neighborhood ?? "",
          city: j.city ?? "",
          state: (j.state ?? "").toUpperCase(),
          complement: "",
          ibge: undefined,
        };
      }
    }
  } catch {
    /* swallow */
  }

  return null;
}
