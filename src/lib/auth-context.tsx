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

const Ctx = createContext<AuthCtx>({ user: null, session: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession(nextSession: Session | null) {
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, company_id, email, full_name")
        .eq("id", nextSession.user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("[Auth] Falha ao carregar profile:", error);
        setProfile(null);
      } else {
        setProfile((data as Profile | null) ?? null);
      }
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Ignore TOKEN_REFRESHED / INITIAL_SESSION — avoids refetching profile
      // on every token refresh (~hourly + tab focus) and on every mount.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        // Still sync the session reference so consumers have fresh tokens.
        setSession(s);
        return;
      }
      void loadSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      void loadSession(data.session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, profile, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
