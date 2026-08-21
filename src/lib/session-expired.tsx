import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const SESSION_EXPIRED_EVENT = "smartpro:session-expired";

/** Rotas onde o modal NÃO deve aparecer (públicas). */
const PUBLIC_ROUTE_PREFIXES = [
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/q/",
  "/r/",
  "/invite/",
  "/privacy",
  "/terms",
  "/",
];

function isPublicPathname(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_ROUTE_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)),
  );
}

/** Dispara o modal global. Seguro para chamar em qualquer contexto (client-side). */
export function emitSessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

type Ctx = { open: boolean; show: () => void; hide: () => void };
const SessionExpiredCtx = createContext<Ctx | null>(null);

export function useSessionExpired() {
  const ctx = useContext(SessionExpiredCtx);
  if (!ctx) throw new Error("useSessionExpired must be used within <SessionExpiredProvider>");
  return ctx;
}

export function SessionExpiredProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = () => {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
      if (isPublicPathname(pathname)) return;
      setOpen(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  const goLogin = useCallback(() => {
    const current =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/dashboard";
    setOpen(false);
    router.navigate({
      to: "/auth",
      search: { redirectTo: current },
      replace: true,
    });
  }, [router]);

  return (
    <SessionExpiredCtx.Provider value={{ open, show, hide }}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && hide()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sessão expirada</DialogTitle>
            <DialogDescription>
              Por segurança, sua sessão expirou. Entre novamente para continuar de onde parou.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={hide}>
              Continuar nesta tela
            </Button>
            <Button onClick={goLogin}>Entrar novamente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionExpiredCtx.Provider>
  );
}
