import type { ReactNode } from "react";
import { Lock, Sparkles, ArrowRight, Check, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFeatures, usePlan, type FeatureCode } from "@/lib/features";
import { cn } from "@/lib/utils";

type FeatureMeta = {
  label: string;
  tagline: string;
  description: string;
  benefits: string[];
  useCases: string[];
  minPlan: "pro" | "business";
};

const FEATURE_META: Record<string, FeatureMeta> = {
  crm: {
    label: "CRM",
    tagline: "Pipeline de vendas e relacionamento",
    description:
      "Acompanhe oportunidades, leads e clientes em um único funil visual. Aumente sua taxa de conversão com follow-ups automáticos.",
    benefits: [
      "Funil de vendas visual (Kanban)",
      "Histórico completo de interações",
      "Lembretes e tarefas automáticas",
      "Relatórios de conversão por etapa",
    ],
    useCases: [
      "Empresa que recebe leads de várias fontes",
      "Time comercial com múltiplos vendedores",
      "Vendas consultivas com longo ciclo",
    ],
    minPlan: "pro",
  },
  financial: {
    label: "Financeiro",
    tagline: "Contas a pagar e a receber",
    description:
      "Controle total do fluxo de caixa com lançamentos, conciliação bancária e relatórios DRE.",
    benefits: [
      "Contas a pagar e receber",
      "Fluxo de caixa projetado",
      "Conciliação bancária",
      "Centro de custos",
    ],
    useCases: [
      "Gestão completa do caixa da empresa",
      "Acompanhar inadimplência de clientes",
      "Planejamento financeiro mensal",
    ],
    minPlan: "pro",
  },
  pix: {
    label: "PIX",
    tagline: "Cobranças automáticas via PIX",
    description:
      "Gere cobranças PIX dinâmicas com QR Code e receba confirmação automática em tempo real.",
    benefits: [
      "QR Code dinâmico por venda",
      "Webhook de confirmação automática",
      "Conciliação automática",
      "Redução drástica da inadimplência",
    ],
    useCases: ["E-commerce", "Cobrança de mensalidades", "Vendas presenciais com link"],
    minPlan: "pro",
  },
  service_orders: {
    label: "Ordens de Serviço",
    tagline: "OS técnicas com checklist e fotos",
    description:
      "Gerencie ordens de serviço do técnico em campo, com check-in, evidências fotográficas e assinatura digital.",
    benefits: [
      "App técnico em campo",
      "Checklist e evidências fotográficas",
      "Assinatura digital do cliente",
      "Histórico por equipamento",
    ],
    useCases: ["Instalação de alarmes/câmeras", "Manutenção preventiva", "Assistência técnica"],
    minPlan: "pro",
  },
  ocr: {
    label: "OCR de Documentos",
    tagline: "Extração inteligente de dados",
    description:
      "Importe notas fiscais, boletos e contratos com reconhecimento óptico — sem digitação manual.",
    benefits: [
      "Leitura automática de NFe/boletos",
      "Extração de dados estruturados",
      "Importação em 1 clique",
      "Redução de erros de digitação",
    ],
    useCases: [
      "Cadastro de notas de fornecedores",
      "Lançamento de boletos",
      "Digitalização de contratos",
    ],
    minPlan: "pro",
  },
  excel_import: {
    label: "Importação Excel",
    tagline: "Importação em massa via planilhas",
    description:
      "Importe milhares de produtos, clientes ou contatos a partir de planilhas Excel/CSV.",
    benefits: [
      "Templates prontos",
      "Validação automática de dados",
      "Mapeamento flexível de colunas",
      "Importação assíncrona com relatório",
    ],
    useCases: [
      "Migração de sistema antigo",
      "Cadastro inicial em massa",
      "Atualização periódica de preços",
    ],
    minPlan: "pro",
  },
  reports_advanced: {
    label: "Relatórios Avançados",
    tagline: "Analytics e BI",
    description:
      "Painéis analíticos avançados com cruzamento de dados, drill-down e exportação personalizada.",
    benefits: [
      "Dashboards customizáveis",
      "Drill-down por dimensão",
      "Exportação Excel/PDF",
      "Agendamento por e-mail",
    ],
    useCases: ["Análise de margem por produto", "Performance comercial", "Indicadores executivos"],
    minPlan: "pro",
  },
  nfe: {
    label: "Nota Fiscal Eletrônica",
    tagline: "Emissão de NFe homologada",
    description:
      "Emissão de NFe integrada com a SEFAZ, com gestão de certificado digital e contingência.",
    benefits: [
      "Emissão direta para SEFAZ",
      "Gestão de certificado A1/A3",
      "DANFE em PDF e XML",
      "Contingência automática",
    ],
    useCases: [
      "Vendas com nota fiscal",
      "Devoluções e cancelamentos",
      "Exportação para contabilidade",
    ],
    minPlan: "business",
  },
  api_access: {
    label: "Acesso à API",
    tagline: "Integre o SmartPro a qualquer sistema",
    description: "API REST completa com autenticação por token, webhooks e documentação OpenAPI.",
    benefits: [
      "Endpoints REST documentados",
      "Webhooks de eventos",
      "Tokens com escopo granular",
      "Rate limit generoso",
    ],
    useCases: [
      "Integração com e-commerce",
      "Sincronização com marketplace",
      "Aplicativos próprios",
    ],
    minPlan: "business",
  },
  white_label: {
    label: "White Label",
    tagline: "Sua marca, nossa plataforma",
    description:
      "Personalize logo, cores e domínio próprio para revender ou usar com sua identidade visual.",
    benefits: [
      "Domínio próprio",
      "Logo e cores customizadas",
      "E-mails com sua marca",
      "Sem menção ao SmartPro",
    ],
    useCases: ["Consultorias revendendo o ERP", "Holdings com múltiplas marcas"],
    minPlan: "business",
  },
  smart_receiving: {
    label: "Recebimento Inteligente",
    tagline: "IA lê notas fiscais e dá entrada no estoque",
    description:
      "Tire uma foto ou envie um PDF da nota fiscal — a IA identifica fornecedor, itens, quantidades e preços, e cria a entrada no estoque automaticamente.",
    benefits: [
      "OCR + IA com Gemini multimodal",
      "Reconhece itens existentes do catálogo",
      "Cria novos itens sob aprovação",
      "Entrada no estoque em 1 clique",
      "Aprende com correções do usuário",
    ],
    useCases: [
      "Compras presenciais em lojas",
      "Receber notas escaneadas",
      "Reduzir digitação manual",
    ],
    minPlan: "pro",
  },
  ai_assistant: {
    label: "SmartCom IA",
    tagline: "Copiloto administrativo e operacional",
    description:
      "Use o SmartCom IA para criar rascunhos de orçamentos, descrições de serviços, checklists de OS, mensagens para clientes e relatórios técnicos — sem sair do sistema.",
    benefits: [
      "Rascunhos de orçamento e proposta",
      "Sugestões de descrição profissional",
      "Checklists de OS prontos",
      "Mensagens de WhatsApp e follow-up",
      "Apoio técnico em CFTV, alarme, controle de acesso e mais",
    ],
    useCases: [
      "Acelerar redação de orçamentos",
      "Padronizar relatórios técnicos",
      "Apoiar equipe de campo no dia a dia",
    ],
    minPlan: "pro",
  },
};

function generic(code: string): FeatureMeta {
  return {
    label: code,
    tagline: "Recurso premium",
    description: "Faça upgrade do seu plano para desbloquear esta funcionalidade.",
    benefits: ["Disponível em planos superiores"],
    useCases: [],
    minPlan: "pro",
  };
}

export function FeatureBlocked({ feature }: { feature: FeatureCode }) {
  const { openUpgrade } = useFeatures();
  const { plan: currentPlan } = usePlan();
  const meta = FEATURE_META[feature] ?? generic(feature);
  const planLabel = meta.minPlan === "business" ? "Business" : "Pro";

  return (
    <div className="mx-auto max-w-5xl py-6">
      <Card className="card-elevated overflow-hidden">
        <div className="brand-gradient p-8 text-primary-foreground">
          <Badge className="mb-3 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25">
            <Sparkles className="mr-1 h-3 w-3" />
            Disponível no plano {planLabel}
          </Badge>
          <h1 className="text-3xl font-bold">{meta.label}</h1>
          <p className="mt-1 text-lg text-primary-foreground/90">{meta.tagline}</p>
        </div>

        <CardContent className="space-y-6 p-8">
          <p className="text-base text-foreground">{meta.description}</p>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                O que você ganha
              </h3>
              <ul className="space-y-2">
                {meta.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            {meta.useCases.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Casos de uso
                </h3>
                <ul className="space-y-2">
                  {meta.useCases.map((u) => (
                    <li key={u} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Comparação de planos
            </h3>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <PlanCompare
                label="Starter"
                included={false}
                current={currentPlan?.slug === "starter"}
              />
              <PlanCompare
                label="Pro"
                included={meta.minPlan === "pro"}
                current={currentPlan?.slug === "pro"}
              />
              <PlanCompare
                label="Business"
                included={true}
                current={currentPlan?.slug === "business"}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => openUpgrade(feature)}
              size="lg"
              className="brand-gradient flex-1 text-primary-foreground"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Solicitar Upgrade
            </Button>
            <Button asChild size="lg" variant="outline" className="flex-1">
              <a href="mailto:comercial@secureerp.com.br?subject=Quero conversar sobre upgrade">
                <Phone className="mr-2 h-4 w-4" />
                Falar com Consultor
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCompare({
  label,
  included,
  current,
}: {
  label: string;
  included: boolean;
  current: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border bg-background px-3 py-2",
        current && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="flex flex-col">
        <span className="text-xs font-semibold">{label}</span>
        {current && <span className="text-nano text-primary">Seu plano</span>}
      </div>
      {included ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50" />
      )}
    </div>
  );
}

export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: FeatureCode;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasFeature } = useFeatures();
  if (!hasFeature(feature)) return <>{fallback ?? <FeatureBlocked feature={feature} />}</>;
  return <>{children}</>;
}

// Helper export used elsewhere
export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(FEATURE_META).map(([k, v]) => [k, v.label]),
);

// Add cadeado icon export for sidebar parity
export { Lock as LockIcon };
