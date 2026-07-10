/**
 * Rascunhos locais (localStorage) para formulários longos.
 *
 * Chave: smartpro:draft:{scope}:{company_id}:{user_id}[:{id}]
 * Isolamento por empresa/usuário é obrigatório.
 *
 * Regras:
 * - Nunca salvar tokens, senhas, chaves ou dados sensíveis.
 * - JSON inválido nunca deve quebrar a tela — retorna null.
 * - Restauração só ocorre se a chave bater exatamente com o usuário/empresa atuais.
 */

const PREFIX = "smartpro:draft";

export function buildDraftKey(
  scope: string,
  companyId: string | null | undefined,
  userId: string | null | undefined,
  id?: string | null,
): string | null {
  if (!scope || !companyId || !userId) return null;
  return id
    ? `${PREFIX}:${scope}:${companyId}:${userId}:${id}`
    : `${PREFIX}:${scope}:${companyId}:${userId}`;
}

interface DraftEnvelope<T> {
  v: 1;
  savedAt: number;
  data: T;
}

export function saveDraft<T>(key: string | null, data: T): void {
  if (!key || typeof window === "undefined") return;
  try {
    const env: DraftEnvelope<T> = { v: 1, savedAt: Date.now(), data };
    window.localStorage.setItem(key, JSON.stringify(env));
  } catch {
    /* quota / disabled storage: silencioso */
  }
}

export function loadDraft<T>(key: string | null): T | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed !== "object" || parsed.v !== 1) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string | null): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function hasDraft(key: string | null): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function getDraftSavedAt(key: string | null): number | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<unknown>;
    return typeof parsed?.savedAt === "number" ? parsed.savedAt : null;
  } catch {
    return null;
  }
}
