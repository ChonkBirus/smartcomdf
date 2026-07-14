import { QueryClient } from "@tanstack/react-query";
import {
  Outlet, createRootRouteWithContext, HeadContent, Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return <main style={{ padding: 40 }}><h1>404</h1><p>Página não encontrada</p></main>;
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error("[ROOT_ERROR_BOUNDARY_MINIMAL]", error);
  return <main style={{ padding: 40 }}><h1>ROOT ERROR</h1><pre>{error.message}</pre></main>;
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
  return <Outlet />;
}
