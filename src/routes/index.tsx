import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartPro | ERP para segurança eletrônica" },
      {
        name: "description",
        content:
          "Sistema online para empresas de segurança eletrônica gerenciarem clientes, produtos, orçamentos, projetos, ordens de serviço e financeiro.",
      },
      { property: "og:title", content: "SmartPro | ERP para segurança eletrônica" },
      {
        property: "og:description",
        content:
          "Orçamentos, estoque, projetos, ordens de serviço e financeiro em uma plataforma simples para segurança eletrônica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://smartcompro.lovable.app/" }],
  }),
  component: LandingPage,
});

const highlights = [
  "Orçamentos com PDF e link público",
  "Projetos e ordens de serviço vinculados",
  "Controle de estoque e financeiro operacional",
];

function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2" aria-label="SmartPro">
            <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="text-base font-bold">SmartPro</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth" search={{ redirectTo: undefined }}>Entrar</Link>
          </Button>
        </header>

        <div className="grid flex-1 items-center gap-10 py-14 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-medium uppercase text-primary">ERP para segurança eletrônica</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              Organize sua operação do orçamento à ordem de serviço.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              O SmartPro centraliza clientes, produtos, propostas, projetos, técnicos, financeiro e execução em campo para empresas de instalação e manutenção.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth" search={{ redirectTo: undefined }}>
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/forgot-password">Recuperar acesso</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Fluxo principal</h2>
            <ul className="mt-5 space-y-4">
              {highlights.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}