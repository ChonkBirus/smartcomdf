// Dev-only auth diagnostics logger.
// Stores a bounded ring buffer of auth flow events in localStorage so a dev
// diagnostics page can display recent signUp / resetPassword / invite attempts
// WITHOUT logging passwords, tokens, full emails or any secrets.

export type AuthDevFlow = "signup" | "reset_password" | "invite" | "invite_resend";
export type AuthDevStatus = "attempt" | "success" | "error";

export interface AuthDevEntry {
  ts: string;            // ISO timestamp
  flow: AuthDevFlow;
  status: AuthDevStatus;
  emailMasked?: string;  // e.g. "j***@gmail.com"
  redirectUrl?: string;  // safe — public URL
  message?: string;      // error.message or short note
}

const KEY = "smartcom:auth-dev-log";
const MAX = 50;

function isDev(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

export function maskEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  const head = user.slice(0, 1);
  return `${head}${"*".repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export function logAuthDev(entry: Omit<AuthDevEntry, "ts">): void {
  if (!isDev() || typeof window === "undefined") return;
  try {
    const list = readAuthDevLog();
    list.unshift({ ts: new Date().toISOString(), ...entry });
    const trimmed = list.slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function readAuthDevLog(): AuthDevEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearAuthDevLog(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function isAuthDevEnabled(): boolean {
  return isDev();
}
