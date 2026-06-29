import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck, ArrowRight, Check, MessageCircle, FileText, Package, Wrench,
  Camera, Bot, Smartphone, Receipt, Zap, Users, ClipboardList, Workflow,
  AlertTriangle, CheckCircle2, Sparkles, BarChart3, MapPin, ImageIcon,
  PenLine, QrCode, FileSpreadsheet, Building2, ListChecks, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const WHATSAPP_NUMBER =
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.replace(/\D/g, "") ||
  "5511999999999";
const WHATSAPP_MSG = encodeURIComponent(
  "Olá! Quero conhecer o SmartCom Pro e testar o sistema para minha empresa de segurança eletrônica."
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartCom Pro | ERP para empresas de segurança eletrônica" },
      {
        name: "description",
        content:
          "Sistema online para empresas de segurança eletrônica gerenciarem clientes, produtos, estoque, orçamentos, projetos, ordens de serviço, técnicos, relatórios e IA.",
      },
      {
        name: "keywords",
        content:
          "ERP segurança eletrônica, sistema para CFTV, sistema de ordem de serviço, sistema para empresa de segurança, controle de estoque segurança eletrônica, orçamento segurança eletrônica",
      },
      { property: "og:title", content: "SmartCom Pro | ERP para empresas de segurança eletrônica" },
      {
        property: "og:description",
        content:
          "Orçamento, estoque, OS, técnico em campo e relatórios com fotos — tudo em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://smartcompro.lovable.app/" },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7a404137-d6af-41cb-aa03-3f139ee433fc",
      },
      { name: "twitter:title", content: "SmartCom Pro | ERP para empresas de segurança eletrônica" },
      {
        name: "twitter:description",
        content: "Orçamento, estoque, OS, técnico em campo e relatórios com fotos — tudo em um só lugar.",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7a404137-d6af-41cb-aa03-3f139ee433fc",
      },
    ],
    links: [{ rel: "canonical", href: "https://smartcompro.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "SmartCom Pro",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://smartcompro.lovable.app/",
          description:
            "ERP SaaS para empresas de segurança eletrônica: clientes, produtos, estoque, orçamentos, projetos, ordens de serviço, técnicos em campo e relatórios.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL", category: "free trial" },
          inLanguage: "pt-BR",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            ["Preciso instalar algum programa?", "Não. O SmartCom Pro funciona online, pelo navegador, e foi pensado para uso em computador e celular."],
            ["Serve para empresas pequenas?", "Sim. O Starter é para empresas pequenas começarem com clientes, produtos, estoque e orçamentos."],
            ["O técnico consegue usar pelo celular?", "Sim. A área de OS foi pensada para uso mobile, com checklist, fotos, materiais e finalização técnica."],
            ["O sistema emite nota fiscal?", "A emissão de NFe/NFSe está prevista para fase futura nos planos avançados."],
            ["A IA lança tudo sozinha?", "Não. A IA ajuda a ler e preencher dados, mas o usuário revisa e confirma antes de gravar."],
            ["Tem teste grátis?", "Sim. O teste grátis dura 7 dias."],
            ["Posso importar produtos e clientes?", "Sim. O sistema aceita importação por Excel ou CSV."],
            ["Tem suporte?", "Sim. O cliente pode falar com o suporte pelo WhatsApp informado na página."],
          ].map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }),
      },
    ],
  }),
  component: Landing,
});

/* -------------------------- shared building blocks ------------------------- */

function Section({
  id, eyebrow, title, subtitle, children, className = "",
}: {
  id?: string; eyebrow?: string; title?: string; subtitle?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 py-20 md:py-28 ${className}`}>
      <div className="mx-auto max-w-6xl px-4">
        {(eyebrow || title || subtitle) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {eyebrow && (
              <span className="inline-flex items-center rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-4 text-base text-muted-foreground md:text-lg">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon, title, desc,
}: { icon: React.ComponentType<{ className?: string }>; title: string; desc?: string }) {
  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card/60 backdrop-blur transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="p-5">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold leading-tight">{title}</h3>
        {desc && <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>}
      </CardContent>
    </Card>
  );
}

/* --------------------------------- HEADER --------------------------------- */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="#top" className="flex items-center gap-2">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg shadow-lg shadow-primary/20">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-base font-bold tracking-tight">SmartCom Pro</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#benefits" className="hover:text-foreground">Benefícios</a>
          <a href="#features" className="hover:text-foreground">Funcionalidades</a>
          <a href="#ai" className="hover:text-foreground">IA</a>
          <a href="#pricing" className="hover:text-foreground">Planos</a>
          <a href="#faq" className="hover:text-foreground">Dúvidas</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Começar teste grátis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------- HERO ---------------------------------- */

function Hero() {
  const quickProofs = [
    { icon: FileText, t: "Orçamentos em minutos" },
    { icon: Package, t: "Estoque sempre visível" },
    { icon: Smartphone, t: "OS no celular do técnico" },
    { icon: Camera, t: "Relatório final com fotos" },
    { icon: Bot, t: "IA para notas e arquivos" },
  ];
  return (
    <section id="top" className="relative overflow-hidden border-b border-border/60">
      {/* Decorative gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-40 right-0 h-[300px] w-[300px] rounded-full bg-chart-2/10 blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
        <div>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            ERP para empresas de segurança eletrônica
          </Badge>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Sua empresa de segurança eletrônica{" "}
            <span className="bg-gradient-to-r from-primary to-chart-4 bg-clip-text text-transparent">
              organizada do orçamento à ordem de serviço
            </span>
            .
          </h1>
          <p className="mt-5 text-base text-muted-foreground md:text-lg">
            Crie orçamentos profissionais, controle estoque, acompanhe técnicos em campo,
            gere relatórios com fotos e use IA para acelerar cadastros, compras e notas.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth">Começar teste grátis <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="link" className="gap-2 text-muted-foreground hover:text-foreground">
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> Prefiro falar no WhatsApp
              </a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem cartão • LGPD • Cancele quando quiser • 7 dias grátis
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              <strong className="text-foreground">+50 empresas</strong> em piloto no Brasil
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Dados protegidos (LGPD)
            </span>
          </div>


          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            {quickProofs.map((p) => (
              <div key={p.t} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm">
                <p.icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{p.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: mockup */}
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-chart-2/20 blur-2xl" />
          <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-2xl shadow-primary/10 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              </div>
              <span className="text-xs text-muted-foreground">smartcompro.app</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MockCard tone="success" icon={CheckCircle2} title="Orçamento aprovado" sub="#0231 · Condomínio Vista" value="R$ 18.450" />
              <MockCard tone="warning" icon={QrCode} title="Pix de entrada" sub="Aguardando confirmação" value="50%" />
              <MockCard tone="primary" icon={Workflow} title="Projeto pronto para OS" sub="Equipe Alpha · 3 itens" />
              <MockCard tone="primary" icon={MapPin} title="Técnico em campo" sub="OS #0142 em execução" />
              <MockCard tone="destructive" icon={AlertTriangle} title="Estoque baixo" sub="Câmera Bullet 4MP · 2 un" />
              <MockCard tone="success" icon={FileText} title="Relatório enviado" sub="Cliente assinou agora" />
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Prévia ilustrativa da interface do SmartCom Pro.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}

function MockCard({
  tone = "primary", icon: Icon, title, sub, value,
}: {
  tone?: "primary" | "success" | "warning" | "destructive";
  icon: React.ComponentType<{ className?: string }>;
  title: string; sub: string; value?: string;
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary ring-primary/20",
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
    destructive: "bg-destructive/10 text-destructive ring-destructive/20",
  } as const;
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        {value && <span className="text-sm font-semibold">{value}</span>}
      </div>
      <div className="mt-2 text-sm font-medium leading-tight">{title}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

/* ------------------------------ SOCIAL PROOF ----------------------------- */

function SocialProof() {
  const testimonials = [
    {
      name: "Rafael Andrade",
      role: "Diretor — SecureCam DF",
      quote: "Reduzi 4h/dia de retrabalho. Hoje o técnico finaliza a OS no celular e o cliente recebe o relatório com fotos no mesmo dia.",
      initials: "RA",
      result: "−4h/dia retrabalho",
    },
    {
      name: "Camila Souza",
      role: "Sócia — VigiaTech Goiânia",
      quote: "Os orçamentos passaram a ser fechados em 2 dias em vez de 2 semanas. O aceite eletrônico e o Pix de entrada mudaram o jogo.",
      initials: "CS",
      result: "7× mais rápido para fechar",
    },
    {
      name: "Marcos Pereira",
      role: "Gerente — AlphaSec Brasília",
      quote: "Antes vivia perdendo material em obra. O estoque por local e a baixa pela OS organizaram tudo. Vale cada centavo.",
      initials: "MP",
      result: "Estoque sob controle",
    },
  ];
  return (
    <section className="border-b border-border/60 bg-card/30 py-14">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-8 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Empresas de segurança eletrônica que já organizaram a operação
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.name} className="border-border/60 bg-background/60">
              <CardContent className="p-5">
                <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">
                  <TrendingUp className="h-3 w-3" /> {t.result}
                </div>
                <p className="text-sm leading-relaxed text-foreground">"{t.quote}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/20">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ INLINE CTA ------------------------------- */

function InlineCTA({ label = "Começar teste grátis" }: { label?: string }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-2">
      <Button asChild size="lg" className="gap-2">
        <Link to="/auth">{label} <ArrowRight className="h-4 w-4" /></Link>
      </Button>
      <p className="text-xs text-muted-foreground">Sem cartão • 7 dias grátis</p>
    </div>
  );
}

/* ---------------------------- PAIN / SOLUTION ---------------------------- */


function Pains() {
  const items = [
    "Orçamentos sem padrão",
    "Estoque sem controle",
    "Técnicos sem histórico",
    "Fotos perdidas no celular",
    "Cliente sem retorno",
    "Retrabalho na emissão de OS",
    "Compras lançadas manualmente",
    "Falta de visão do lucro",
  ];
  return (
    <Section
      id="benefits"
      eyebrow="Dores reais"
      title="Sua operação ainda depende de planilhas, WhatsApp e memória?"
      subtitle="O problema não é falta de serviço. É falta de processo."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((t) => (
          <div key={t} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span className="text-sm">{t}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Solution() {
  const items: Array<[React.ComponentType<{ className?: string }>, string]> = [
    [Users, "Clientes"],
    [Package, "Produtos e serviços"],
    [Package, "Estoque"],
    [FileText, "Orçamentos"],
    [PenLine, "Aceite eletrônico"],
    [QrCode, "Pix de entrada"],
    [Workflow, "Projetos"],
    [ClipboardList, "Ordens de serviço"],
    [ListChecks, "Checklist técnico"],
    [Camera, "Fotos antes e depois"],
    [FileText, "Relatório final"],
    [PenLine, "Assinatura do cliente"],
    [FileSpreadsheet, "Importação Excel/CSV"],
    [Bot, "IA para notas e compras"],
  ];
  return (
    <Section
      id="features"
      eyebrow="A solução"
      title="O SmartCom Pro centraliza sua operação em uma única plataforma."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([Icon, title]) => (
          <FeatureCard key={title} icon={Icon} title={title} />
        ))}
      </div>
      <InlineCTA />
    </Section>

  );
}

/* --------------------------------- FLOW ---------------------------------- */

function Flow() {
  const steps = [
    "Cadastre o cliente",
    "Crie o orçamento",
    "Envie link e PDF",
    "Cliente aceita",
    "Receba entrada via Pix",
    "Converta em projeto",
    "Gere OS",
    "Técnico executa pelo celular",
    "Registre fotos, checklist e materiais",
    "Gere relatório final",
  ];
  return (
    <Section
      eyebrow="Fluxo completo"
      title="Do orçamento ao relatório final"
      subtitle="Um fluxo completo para sua empresa parar de improvisar."
    >
      <ol className="relative grid gap-3 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-1 text-sm font-medium">{s}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ----------------------------------- AI ---------------------------------- */

function AISection() {
  const items: Array<[React.ComponentType<{ className?: string }>, string]> = [
    [Receipt, "Leitura de nota fiscal de compra"],
    [Package, "Entrada inteligente no estoque"],
    [Sparkles, "Sugestão de produtos"],
    [FileSpreadsheet, "Importação Excel/CSV"],
    [Building2, "Cadastro rápido por CNPJ"],
    [TrendingUp, "Organização de compras e fornecedores"],
  ];
  return (
    <Section
      id="ai"
      eyebrow="Inteligência Artificial"
      title="IA para reduzir cadastro manual e acelerar sua operação."
      subtitle="O SmartCom Pro usa IA para ler notas, arquivos, produtos e dados operacionais, reduzindo trabalho manual e erros de digitação."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([Icon, t]) => (
          <FeatureCard key={t} icon={Icon} title={t} />
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        A IA ajuda a preencher e organizar. Você revisa e confirma antes de gravar.
      </p>
    </Section>
  );
}

/* -------------------------------- MOBILE OS ------------------------------ */

function MobileOS() {
  const items = [
    "Ver OS do dia", "Abrir mapa", "Chamar cliente no WhatsApp",
    "Iniciar atendimento", "Pausar e retomar", "Preencher checklist",
    "Enviar fotos", "Registrar materiais usados", "Finalizar execução",
  ];
  return (
    <Section
      eyebrow="Mobile"
      title="Ordem de serviço no celular do técnico."
      subtitle="Tudo o que o técnico precisa, na palma da mão — sem papel, sem ligação para o escritório."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <div key={t} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
            <Check className="h-4 w-4 shrink-0 text-success" />
            <span className="text-sm">{t}</span>
          </div>
        ))}
      </div>
      <InlineCTA label="Quero testar no celular do meu técnico" />
    </Section>

  );
}

/* --------------------------------- STOCK -------------------------------- */

function Stock() {
  const items: Array<[React.ComponentType<{ className?: string }>, string]> = [
    [MapPin, "Estoque por local"],
    [AlertTriangle, "Estoque mínimo"],
    [Receipt, "Entrada por compra"],
    [FileSpreadsheet, "Importação inicial"],
    [Wrench, "Materiais usados na OS"],
    [CheckCircle2, "Baixa controlada"],
  ];
  return (
    <Section
      eyebrow="Estoque"
      title="Pare de perder material sem perceber."
      subtitle="Controle produtos, locais, entradas, saídas, importações e materiais usados em cada OS."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([Icon, t]) => (
          <FeatureCard key={t} icon={Icon} title={t} />
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------- QUOTES --------------------------------- */

function Quotes() {
  const items = [
    "PDF profissional", "Link público", "Aceite eletrônico",
    "Pix de entrada", "WhatsApp pronto", "Histórico de envio",
  ];
  return (
    <Section
      eyebrow="Orçamentos"
      title="Orçamentos com aparência profissional e valor fechado."
      subtitle="Envie propostas com fotos, descrição, condições, prazo, garantia e aceite eletrônico. O cliente vê o valor total, sem expor custos, margem ou dados internos."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <div key={t} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium">{t}</span>
          </div>
        ))}
      </div>
      <InlineCTA label="Criar meu primeiro orçamento grátis" />
    </Section>
  );
}


/* -------------------------------- PRICING ------------------------------- */

function Pricing() {
  const plans = [
    {
      name: "Starter", price: "R$ 97", featured: false,
      desc: "Para começar a organizar clientes, produtos, estoque e orçamentos.",
      cta: "Começar no Starter",
      features: [
        "Clientes", "Produtos e serviços", "Estoque", "Orçamentos",
        "PDF e link público", "Aceite eletrônico", "Pix de entrada manual",
        "Até 3 usuários",
      ],
    },
    {
      name: "Pro", price: "R$ 247", featured: true,
      desc: "Para empresas que fazem instalação, manutenção e atendimento técnico.",
      cta: "Começar no Pro",
      features: [
        "Tudo do Starter", "Projetos", "Ordens de serviço", "Checklist",
        "Fotos", "Relatório final", "Assinatura eletrônica simples",
        "Importação Excel/CSV", "IA/OCR", "Compras e fornecedores",
        "Até 10 usuários",
      ],
    },
    {
      name: "Business", price: "R$ 497", featured: false,
      desc: "Para empresas com operação avançada e equipe maior.",
      cta: "Falar com consultor",
      features: [
        "Tudo do Pro", "Usuários ilimitados", "Mais armazenamento",
        "Limite maior de IA/OCR", "Integrações futuras",
        "Financeiro avançado futuro", "NFe/NFSe futura", "Suporte prioritário",
      ],
    },
  ];
  return (
    <Section
      id="pricing"
      eyebrow="Planos"
      title="Escolha o plano da sua operação"
      subtitle="Teste grátis por 7 dias. Cancele quando quiser."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const isConsultant = p.cta.includes("consultor");
          return (
            <Card
              key={p.name}
              className={`relative flex flex-col border-border/60 bg-card/60 backdrop-blur ${
                p.featured ? "border-primary/60 shadow-2xl shadow-primary/10 md:-translate-y-2" : ""
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Mais recomendado</Badge>
                </div>
              )}
              <CardContent className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-6 w-full"
                  variant={p.featured ? "default" : "outline"}
                >
                  {isConsultant ? (
                    <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">{p.cta}</a>
                  ) : (
                    <Link to="/auth">{p.cta}</Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Teste grátis por 7 dias. Cancele quando quiser.
      </p>
    </Section>
  );
}

/* ------------------------------ BEFORE/AFTER ---------------------------- */

function BeforeAfter() {
  const rows = [
    ["Orçamento no WhatsApp", "Orçamento profissional com PDF e link"],
    ["OS em papel", "OS no celular do técnico"],
    ["Estoque na cabeça", "Estoque controlado por local"],
    ["Fotos perdidas", "Fotos anexadas direto à OS"],
    ["Cliente cobrando status", "Histórico completo de atendimento"],
    ["Relatório manual", "Relatório final automático"],
    ["Cobrança sem histórico", "Assinatura eletrônica e envio ao cliente"],
  ];
  return (
    <Section eyebrow="Comparação" title="Antes e depois do SmartCom Pro">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <div className="grid grid-cols-2 border-b border-border/60 bg-muted/30">
          <div className="px-4 py-3 text-sm font-semibold text-muted-foreground">Antes</div>
          <div className="px-4 py-3 text-sm font-semibold text-primary">Depois</div>
        </div>
        {rows.map(([a, b], i) => (
          <div key={a} className={`grid grid-cols-2 text-sm ${i % 2 ? "bg-card/30" : ""}`}>
            <div className="flex items-start gap-2 px-4 py-3 text-muted-foreground line-through">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" /> {a}
            </div>
            <div className="flex items-start gap-2 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {b}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ----------------------------------- FAQ -------------------------------- */

function FAQ() {
  const items = [
    ["Preciso instalar algum programa?", "Não. O SmartCom Pro funciona online, pelo navegador, e foi pensado para uso em computador e celular."],
    ["Serve para empresas pequenas?", "Sim. O Starter é para empresas pequenas começarem com clientes, produtos, estoque e orçamentos."],
    ["O técnico consegue usar pelo celular?", "Sim. A área de OS foi pensada para uso mobile, com checklist, fotos, materiais e finalização técnica."],
    ["O sistema emite nota fiscal?", "A emissão de NFe/NFSe está prevista para fase futura nos planos avançados."],
    ["A IA lança tudo sozinha?", "Não. A IA ajuda a ler e preencher dados, mas o usuário revisa e confirma antes de gravar."],
    ["Tem teste grátis?", "Sim. O teste grátis dura 7 dias."],
    ["Posso importar produtos e clientes?", "Sim. O sistema aceita importação por Excel ou CSV."],
    ["Tem suporte?", "Sim. O cliente pode falar com o suporte pelo WhatsApp informado na página."],
  ];
  return (
    <Section id="faq" eyebrow="Dúvidas frequentes" title="Perguntas que recebemos com frequência">
      <Accordion type="single" collapsible className="mx-auto max-w-3xl">
        {items.map(([q, a]) => (
          <AccordionItem key={q} value={q}>
            <AccordionTrigger className="text-left text-base font-medium">{q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

/* ---------------------------------- CTA --------------------------------- */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-y border-border/60 py-20 md:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-chart-2/10" />
      </div>
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Pronto para organizar sua empresa de segurança eletrônica?
        </h2>
        <p className="mt-4 text-muted-foreground md:text-lg">
          Comece hoje com um sistema feito para orçamento, estoque, OS, técnico em campo e crescimento.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link to="/auth">Começar teste grátis <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            </a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Seus dados ficam protegidos e organizados em ambiente seguro.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------- FOOTER ------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">SmartCom Pro</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            ERP inteligente para segurança eletrônica.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Produto</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#pricing" className="hover:text-foreground">Planos</a></li>
            <li><a href="#features" className="hover:text-foreground">Funcionalidades</a></li>
            <li><Link to="/auth" className="hover:text-foreground">Login</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Empresa</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">Suporte</a></li>
            <li><a href="#" className="hover:text-foreground">Termos de Uso</a></li>
            <li><a href="#" className="hover:text-foreground">Política de Privacidade</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SmartCom Pro. Todos os direitos reservados.
      </div>
    </footer>
  );
}

/* --------------------------------- PAGE --------------------------------- */

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <Pains />
      <Solution />
      <Flow />
      <AISection />
      <MobileOS />
      <Stock />
      <Quotes />
      <Pricing />
      <BeforeAfter />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
