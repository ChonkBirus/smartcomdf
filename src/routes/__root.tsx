import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { StrictMode, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { SessionExpiredProvider } from "@/lib/session-expired";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const isDev = import.meta.env.DEV;
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não conseguimos carregar esta tela. Tente novamente ou volte ao painel.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Voltar ao painel
          </a>
        </div>
        {isDev && (
          <details className="mt-6 rounded-md border bg-muted/40 p-3 text-left text-xs">
            <summary className="cursor-pointer font-medium">Detalhes técnicos (dev)</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
              {error?.name}: {error?.message}
              {error?.stack}
            </pre>
          </details>
        )}
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
      {
        name: "description",
        content:
          "Plataforma SaaS multiempresa para gestão de produtos, clientes, orçamentos, financeiro, CRM e ordens de serviço em segurança eletrônica.",
      },
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
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
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
      <head>
        <HeadContent />
      </head>
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
