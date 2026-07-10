/**
 * Traduz erros técnicos (Supabase, fetch, storage, RLS) em mensagens amigáveis.
 * Nunca expor stack trace para o usuário final.
 */
export type FriendlyErrorKind =
  | "session_expired"
  | "forbidden"
  | "rls"
  | "network"
  | "storage"
  | "generic";

export interface FriendlyError {
  kind: FriendlyErrorKind;
  message: string;
}

const MSG: Record<FriendlyErrorKind, string> = {
  session_expired: "Sua sessão expirou. Entre novamente.",
  forbidden: "Você não tem permissão para realizar esta ação.",
  rls: "Você não tem acesso a este registro.",
  network: "Falha de conexão. Verifique sua internet e tente novamente.",
  storage: "Não foi possível enviar o arquivo. Tente novamente.",
  generic: "Não foi possível concluir a ação. Tente novamente.",
};

function extractText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "object") {
    const anyErr = error as any;
    return [anyErr.message, anyErr.error, anyErr.statusText, anyErr.hint, anyErr.code]
      .filter(Boolean)
      .join(" ");
  }
  return String(error);
}

function extractStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const anyErr = error as any;
  const s = anyErr.status ?? anyErr.statusCode ?? anyErr.code;
  const n = typeof s === "number" ? s : Number(s);
  return Number.isFinite(n) ? n : null;
}

export function classifyError(error: unknown): FriendlyErrorKind {
  const raw = extractText(error).toLowerCase();
  const status = extractStatus(error);

  if (
    status === 401 ||
    raw.includes("jwt expired") ||
    raw.includes("invalid jwt") ||
    raw.includes("invalid token") ||
    raw.includes("token is expired") ||
    raw.includes("unauthorized") ||
    raw.includes("not authenticated") ||
    raw.includes("no authorization header")
  ) {
    return "session_expired";
  }
  if (status === 403 || raw.includes("forbidden") || raw.includes("permission denied")) {
    if (raw.includes("row-level security") || raw.includes("row level security") || raw.includes("rls")) {
      return "rls";
    }
    return "forbidden";
  }
  if (raw.includes("row-level security") || raw.includes("row level security")) {
    return "rls";
  }
  if (
    raw.includes("failed to fetch") ||
    raw.includes("networkerror") ||
    raw.includes("network request failed") ||
    raw.includes("load failed") ||
    (error instanceof TypeError && raw.includes("fetch"))
  ) {
    return "network";
  }
  if (raw.includes("storage") && (raw.includes("upload") || raw.includes("object"))) {
    return "storage";
  }
  return "generic";
}

export function getFriendlyErrorMessage(error: unknown): string {
  return MSG[classifyError(error)];
}

export function toFriendlyError(error: unknown): FriendlyError {
  const kind = classifyError(error);
  return { kind, message: MSG[kind] };
}
