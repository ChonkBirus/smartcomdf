import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { StrictMode, useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { SessionExpiredProvider } from "@/lib/session-expired";
import { classifyError } from "@/lib/error-messages";

type SafeRuntimeDiagnostic = {
  name: string;
  message: string;
  stack: string;
  route: string;
  type: string;
  sessionExists: string;
  userExists: string;
  companyIdExists: string;
  storage: string;
};

declare global {
  interface Window {
    __smartproAuthDiag?: {
      loading: boolean;
      sessionExists: boolean;
      userExists: boolean;
      profileExists: boolean;
      companyIdExists: boolean;
      lastEvent?: string;
      authError?: { name: string; message: string } | null;
      storage: { localAuthKeys: string[]; sessionAuthKeys: string[]; corrupted: boolean };
    };
  }
}

function classifyRuntimeError(error: Error): string {
  const text = `${error.name} ${error.message} ${error.stack ?? ""}`.toLowerCase();
  if (text.includes("hydration") || text.includes("hydrating")) return "hydration";
  if (classifyError(error) === "session_expired" || text.includes("auth") || text.includes("jwt")) return "auth";
  if (text.includes("router") || text.includes("route")) return "router";
  if (text.includes("query") || text.includes("tanstack")) return "query";
  if (text.includes("chunk") || text.includes("failed to fetch dynamically imported module")) return "chunk";
  return "runtime";
}

function isAuthStorageKey(key: string | null): key is string {
  return !!key && (/^sb-[a-z0-9]+-auth-token$/i.test(key) || /supabase\.auth\.token/i.test(key));
}

function countAuthKeys(storage: Storage | undefined): number {
  if (!storage) return 0;
  try {
    let count = 0;
    for (let i = 0; i < storage.length; i += 1) if (isAuthStorageKey(storage.key(i))) count += 1;
    return count;
  } catch {
    return 0;
  }
}

function collectSafeRuntimeDiagnostic(error: Error): SafeRuntimeDiagnostic {
  if (typeof window === "undefined") {
    return {
      name: error.name,
      message: error.message,
      stack: (error.stack ?? "Stack indisponível").split("\n").slice(0, 8).join("\n"),
      route: "SSR",
      type: classifyRuntimeError(error),
      sessionExists: "desconhecido",
      userExists: "desconhecido",
      companyIdExists: "desconhecido",
      storage: "desconhecido",
    };
  }
  const auth = window.__smartproAuthDiag;
  return {
    name: error.name || "Error",
    message: error.message || "Sem mensagem",
    stack: (error.stack ?? "Stack indisponível").split("\n").slice(0, 8).join("\n"),
    route: window.location.pathname + window.location.search,
    type: classifyRuntimeError(error),
    sessionExists: String(auth?.sessionExists ?? "desconhecido"),
    userExists: String(auth?.userExists ?? "desconhecido"),
    companyIdExists: String(auth?.companyIdExists ?? "desconhecido"),
    storage: auth?.storage
      ? `local=${auth.storage.localAuthKeys.length}, session=${auth.storage.sessionAuthKeys.length}, corrompido=${auth.storage.corrupted}`
      : `local=${countAuthKeys(window.localStorage)}, session=${countAuthKeys(window.sessionStorage)}`,
  };
}

function clearLocalAuthAndGoLogin() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (isAuthStorageKey(key)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }
  window.location.href = "/auth";
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Ir para o início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [diagnostic, setDiagnostic] = useState(() => collectSafeRuntimeDiagnostic(error));
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  useEffect(() => { setDiagnostic(collectSafeRuntimeDiagnostic(error)); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não conseguimos carregar esta tela. Tente novamente ou volte ao painel.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Tentar novamente
          </button>
          <a href="/dashboard" className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">Voltar ao painel</a>
          <button onClick={clearLocalAuthAndGoLogin} className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            Limpar sessão local
          </button>
        </div>
        <details open className="mt-6 rounded-md border bg-muted/40 p-3 text-left text-xs">
          <summary className="cursor-pointer font-medium">Diagnóstico seguro</summary>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <dt>Tipo</dt><dd className="break-words text-foreground">{diagnostic.type}</dd>
            <dt>Erro</dt><dd className="break-words text-foreground">{diagnostic.name}</dd>
            <dt>Mensagem</dt><dd className="break-words text-foreground">{diagnostic.message}</dd>
            <dt>Rota</dt><dd className="break-words text-foreground">{diagnostic.route}</dd>
            <dt>Sessão</dt><dd className="break-words text-foreground">{diagnostic.sessionExists}</dd>
            <dt>Usuário</dt><dd className="break-words text-foreground">{diagnostic.userExists}</dd>
            <dt>Empresa</dt><dd className="break-words text-foreground">{diagnostic.companyIdExists}</dd>
            <dt>Storage</dt><dd className="break-words text-foreground">{diagnostic.storage}</dd>
          </dl>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[11px] text-muted-foreground">
            {diagnostic.stack}
          </pre>
        </details>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#111111" },
      { title: "SmartPro — ERP para empresas de segurança eletrônica" },
      { name: "description", content: "Plataforma SaaS multiempresa para gestão de produtos, clientes, orçamentos, financeiro, CRM e ordens de serviço em segurança eletrônica." },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "SmartPro" },
      { property: "og:site_name", content: "SmartPro" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "SmartPro",
          url: "https://smartcompro.lovable.app",
          logo: "https://smartcompro.lovable.app/favicon.ico",
          description: "ERP SaaS para empresas de segurança eletrônica.",
          sameAs: [],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Only react to identity transitions — TOKEN_REFRESHED/INITIAL_SESSION
      // fire often and must not blow away all queries.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      router.invalidate();
      if (event === "SIGNED_IN") {
        // Refresh only user-scoped data, not every cached query.
        queryClient.invalidateQueries({ queryKey: ["me"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  const tree = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SessionExpiredProvider>
            <Outlet />
            <Toaster richColors position="top-right" />
          </SessionExpiredProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return import.meta.env.DEV ? <StrictMode>{tree}</StrictMode> : tree;
}
