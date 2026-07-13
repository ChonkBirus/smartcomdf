import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  company_id: string | null;
  email: string | null;
  full_name: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
};

type SafeAuthDiagnostic = {
  loading: boolean;
  sessionExists: boolean;
  userExists: boolean;
  profileExists: boolean;
  companyIdExists: boolean;
  lastEvent?: string;
  authError?: { name: string; message: string } | null;
  storage: {
    localAuthKeys: string[];
    sessionAuthKeys: string[];
    corrupted: boolean;
  };
};

declare global {
  interface Window {
    __smartproAuthDiag?: SafeAuthDiagnostic;
  }
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, profile: null, loading: true });

function isAuthStorageKey(key: string | null): key is string {
  return !!key && (/^sb-[a-z0-9]+-auth-token$/i.test(key) || /supabase\.auth\.token/i.test(key));
}

function authStorageKeys(storage: Storage | undefined): string[] {
  if (!storage) return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (isAuthStorageKey(key)) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

function hasCorruptedAuthStorage(keys: string[], storage: Storage | undefined): boolean {
  if (!storage) return false;
  return keys.some((key) => {
    const raw = storage.getItem(key);
    if (!raw) return false;
    try {
      JSON.parse(raw);
      return false;
    } catch {
      return true;
    }
  });
}

function getSafeAuthStorageSnapshot() {
  if (typeof window === "undefined") {
    return { localAuthKeys: [], sessionAuthKeys: [], corrupted: false };
  }
  const localAuthKeys = authStorageKeys(window.localStorage);
  const sessionAuthKeys = authStorageKeys(window.sessionStorage);
  return {
    localAuthKeys,
    sessionAuthKeys,
    corrupted:
      hasCorruptedAuthStorage(localAuthKeys, window.localStorage) ||
      hasCorruptedAuthStorage(sessionAuthKeys, window.sessionStorage),
  };
}

export function clearLocalAuthStorage() {
  if (typeof window === "undefined") return;
  const { localAuthKeys, sessionAuthKeys } = getSafeAuthStorageSnapshot();
  for (const key of localAuthKeys) window.localStorage.removeItem(key);
  for (const key of sessionAuthKeys) window.sessionStorage.removeItem(key);
}

function safeAuthError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message || "Sem mensagem" };
  if (error && typeof error === "object" && "message" in error) {
    return { name: "AuthError", message: String((error as { message?: unknown }).message ?? "Sem mensagem") };
  }
  return { name: "AuthError", message: String(error || "Sem mensagem") };
}

function publishAuthDiag(patch: Partial<SafeAuthDiagnostic>) {
  if (typeof window === "undefined") return;
  window.__smartproAuthDiag = {
    loading: true,
    sessionExists: false,
    userExists: false,
    profileExists: false,
    companyIdExists: false,
    authError: null,
    storage: getSafeAuthStorageSnapshot(),
    ...window.__smartproAuthDiag,
    ...patch,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession(nextSession: Session | null) {
      if (getSafeAuthStorageSnapshot().corrupted) {
        clearLocalAuthStorage();
        nextSession = null;
      }
      setSession(nextSession);
      publishAuthDiag({
        loading: true,
        sessionExists: !!nextSession,
        userExists: !!nextSession?.user,
        storage: getSafeAuthStorageSnapshot(),
        authError: null,
      });

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        publishAuthDiag({ loading: false, sessionExists: false, userExists: false, profileExists: false, companyIdExists: false });
        return;
      }

      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        if (userError || !userData.user) {
          clearLocalAuthStorage();
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          setSession(null);
          setProfile(null);
          setLoading(false);
          publishAuthDiag({
            loading: false,
            sessionExists: false,
            userExists: false,
            profileExists: false,
            companyIdExists: false,
            authError: userError ? safeAuthError(userError) : { name: "AuthError", message: "Sessão inválida" },
            storage: getSafeAuthStorageSnapshot(),
          });
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, company_id, email, full_name")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error("[Auth] Falha ao carregar profile:", error);
          setProfile(null);
          publishAuthDiag({ authError: safeAuthError(error), profileExists: false, companyIdExists: false });
        } else {
          const nextProfile = (data as Profile | null) ?? null;
          setProfile(nextProfile);
          publishAuthDiag({ profileExists: !!nextProfile, companyIdExists: !!nextProfile?.company_id, authError: null });
        }
      } catch (error) {
        if (!active) return;
        console.error("[Auth] Falha ao restaurar sessão:", error);
        setProfile(null);
        publishAuthDiag({ authError: safeAuthError(error), profileExists: false, companyIdExists: false });
      } finally {
        if (!active) return;
        setLoading(false);
        publishAuthDiag({ loading: false, storage: getSafeAuthStorageSnapshot() });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      publishAuthDiag({ lastEvent: event, sessionExists: !!s, userExists: !!s?.user });
      // Ignore TOKEN_REFRESHED / INITIAL_SESSION — avoids refetching profile
      // on every token refresh (~hourly + tab focus) and on every mount.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        // Still sync the session reference so consumers have fresh tokens.
        setSession(s);
        return;
      }
      void loadSession(s);
    });
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          clearLocalAuthStorage();
          publishAuthDiag({ authError: safeAuthError(error), loading: false, storage: getSafeAuthStorageSnapshot() });
          void loadSession(null);
          return;
        }
        void loadSession(data.session);
      })
      .catch((error) => {
        clearLocalAuthStorage();
        publishAuthDiag({ authError: safeAuthError(error), loading: false, storage: getSafeAuthStorageSnapshot() });
        void loadSession(null);
      });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={{ user: session?.user ?? null, session, profile, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
