import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Zap, Lock, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SecureERP — ERP para empresas de segurança eletrônica" },
      { name: "description", content: "Plataforma SaaS multiempresa para gestão de produtos, clientes, orçamentos, financeiro, CRM e ordens de serviço em segurança eletrônica." },
      { property: "og:title", content: "SecureERP" },
      { property: "og:description", content: "ERP completo, mobile-first, para empresas de segurança eletrônica." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">SecureERP</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
            <Button asChild><Link to="/auth">Começar grátis</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
            ERP para segurança eletrônica
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
            Gestão completa da sua empresa de <span className="text-primary">segurança eletrônica</span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground md:text-lg">
            Produtos, estoque, clientes, orçamentos, financeiro, CRM, ordens de serviço, PIX, NFe e OCR — tudo em uma plataforma mobile-first.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2"><Link to="/auth">Criar conta grátis <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Mobile-first", desc: "Trabalhe de qualquer lugar, em qualquer dispositivo." },
            { icon: Lock, title: "Multiempresa segura", desc: "Isolamento total entre empresas com RLS." },
            { icon: Users, title: "RBAC granular", desc: "Permissões por papel para toda a equipe." },
          ].map((f) => (
            <div key={f.title} className="card-elevated rounded-xl p-5">
              <div className="brand-gradient mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SecureERP. Todos os direitos reservados.
      </footer>
    </div>
  );
}
