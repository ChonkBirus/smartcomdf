import { useEffect } from "react";
import { Link } from "@tanstack/react-router";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Rocket, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getGettingStartedStatus, type GettingStartedStatus, getOnboardingProgress, upsertOnboardingProgress } from "@/lib/onboarding.functions";
import { cn } from "@/lib/utils";

type Item = {
  key: keyof GettingStartedStatus;
  title: string;
  description: string;
  to: string;
  cta: string;
};

const ITEMS: Item[] = [
  { key: "hasCompanyData", title: "Configurar dados da empresa", description: "Razão social, CNPJ e contato aparecem em propostas e relatórios.", to: "/settings/company", cta: "Configurar empresa" },
  { key: "hasCustomer", title: "Cadastrar primeiro cliente", description: "Comece cadastrando seus clientes para usar em orçamentos, projetos e ordens de serviço.", to: "/clients", cta: "Cadastrar cliente" },
  { key: "hasProduct", title: "Cadastrar primeiro produto ou serviço", description: "Adicione os itens que entram nas suas propostas e atendimentos.", to: "/products", cta: "Cadastrar item" },
  { key: "hasCrmOpportunity", title: "Registrar primeira oportunidade no CRM", description: "Acompanhe leads e negociações no funil de vendas estilo Kanban.", to: "/crm", cta: "Abrir CRM" },
  { key: "hasQuote", title: "Criar primeiro orçamento", description: "Monte uma proposta com itens, condições comerciais e diagnóstico.", to: "/quotes", cta: "Novo orçamento" },
  { key: "hasQuotePdf", title: "Gerar PDF da proposta", description: "Gere a versão Premium para impressionar o cliente.", to: "/quotes", cta: "Ir para orçamentos" },
  { key: "hasQuoteSent", title: "Enviar proposta para o cliente", description: "WhatsApp, e-mail ou link público com aceite eletrônico.", to: "/quotes", cta: "Enviar proposta" },
  { key: "hasQuoteApproved", title: "Aprovar orçamento", description: "Acompanhe o aceite — orçamentos aprovados viram projetos.", to: "/quotes", cta: "Ver orçamentos" },
  { key: "hasCrmWon", title: "Marcar oportunidade como ganha", description: "Feche o ciclo comercial marcando a oportunidade como ganha no CRM.", to: "/crm", cta: "Ir para CRM" },
  { key: "hasServiceOrder", title: "Criar primeira ordem de serviço", description: "Organize a execução com checklist, fotos e relatório.", to: "/service-orders", cta: "Nova OS" },
];

const TOUR_KEY = "getting_started_checklist";

export function GettingStartedChecklist() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getGettingStartedStatus);
  const fetchProgress = useServerFn(getOnboardingProgress);
  const upsertProgress = useServerFn(upsertOnboardingProgress);

  const { data, isLoading } = useQuery({
    queryKey: ["getting_started"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  const { data: progress } = useQuery({
    queryKey: ["onboarding_progress", TOUR_KEY],
    queryFn: () => fetchProgress({ data: { tourKey: TOUR_KEY } }),
    staleTime: 60_000,
  });

  const hideMutation = useMutation({
    mutationFn: () => upsertProgress({ data: { tourKey: TOUR_KEY, status: "SKIPPED" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_progress", TOUR_KEY] }),
  });

  const status = data ?? null;
  const done = status ? ITEMS.filter((i) => status[i.key]).length : 0;
  const total = ITEMS.length;
  const allDone = status && done === total;

  // Persist auto-completion when all steps are done
  const shouldMarkComplete = allDone && progress?.status !== "COMPLETED";
  const completeMutation = useMutation({
    mutationFn: () => upsertProgress({ data: { tourKey: TOUR_KEY, status: "COMPLETED", currentStep: total } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_progress", TOUR_KEY] }),
  });
  if (shouldMarkComplete && !completeMutation.isPending) completeMutation.mutate();

  // Persist progress step count as it changes
  const shouldSyncStep =
    status && !allDone && progress?.status !== "SKIPPED" && (progress?.current_step ?? -1) !== done;
  const stepMutation = useMutation({
    mutationFn: () => upsertProgress({ data: { tourKey: TOUR_KEY, status: "IN_PROGRESS", currentStep: done } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_progress", TOUR_KEY] }),
  });
  if (shouldSyncStep && !stepMutation.isPending) stepMutation.mutate();

  const hidden = progress?.status === "SKIPPED" || progress?.status === "COMPLETED";
  if (hidden) return null;
  if (allDone && !isLoading) return null;


  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-primary" />
            Primeiros passos
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {status ? `${done} de ${total} concluídos` : "Carregando..."}
          </p>
        </div>
        <button
          aria-label="Ocultar checklist"
          onClick={() => hideMutation.mutate()}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-2">
        {ITEMS.map((it) => {
          const ok = !!status?.[it.key];
          return (
            <div
              key={it.key}
              className={cn(
                "flex items-start gap-3 rounded-md border border-border p-3 transition",
                ok && "opacity-60",
              )}
            >
              {ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-medium", ok && "line-through")}>{it.title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.description}</p>
              </div>
              {!ok && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={it.to as never}>{it.cta}</Link>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
