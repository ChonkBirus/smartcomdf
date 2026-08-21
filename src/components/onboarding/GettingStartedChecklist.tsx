import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Rocket, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getGettingStartedStatus,
  type GettingStartedStatus,
  getOnboardingProgress,
  upsertOnboardingProgress,
} from "@/lib/onboarding.functions";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Item = {
  key: keyof GettingStartedStatus;
  title: string;
  description: string;
  to: string;
  cta: string;
};

const CORE_KEYS: Array<keyof GettingStartedStatus> = ["hasCompanyData", "hasProduct", "hasQuote"];

const ITEMS: Item[] = [
  {
    key: "hasCompanyData",
    title: "Configurar dados da empresa",
    description: "Razão social, CNPJ e contato aparecem em propostas e relatórios.",
    to: "/settings/company",
    cta: "Configurar",
  },
  {
    key: "hasProduct",
    title: "Cadastrar primeiro produto ou serviço",
    description: "Adicione os itens que entram nas suas propostas e atendimentos.",
    to: "/products",
    cta: "Cadastrar",
  },
  {
    key: "hasQuote",
    title: "Criar primeiro orçamento",
    description: "Monte uma proposta em minutos — cliente pode ser criado direto no orçamento.",
    to: "/quotes",
    cta: "Criar orçamento",
  },
  {
    key: "hasCustomer",
    title: "Cadastrar primeiro cliente",
    description: "Também dá pra criar clientes direto no orçamento.",
    to: "/clients",
    cta: "Cadastrar cliente",
  },
  {
    key: "hasCrmOpportunity",
    title: "Registrar primeira oportunidade no CRM",
    description: "Acompanhe leads e negociações no funil de vendas estilo Kanban.",
    to: "/crm",
    cta: "Abrir CRM",
  },
  {
    key: "hasQuotePdf",
    title: "Gerar PDF da proposta",
    description: "Gere a versão Premium para impressionar o cliente.",
    to: "/quotes",
    cta: "Ir para orçamentos",
  },
  {
    key: "hasQuoteSent",
    title: "Enviar proposta para o cliente",
    description: "WhatsApp, e-mail ou link público com aceite eletrônico.",
    to: "/quotes",
    cta: "Enviar",
  },
  {
    key: "hasQuoteApproved",
    title: "Aprovar orçamento",
    description: "Acompanhe o aceite — orçamentos aprovados viram projetos.",
    to: "/quotes",
    cta: "Ver orçamentos",
  },
  {
    key: "hasCrmWon",
    title: "Marcar oportunidade como ganha",
    description: "Feche o ciclo comercial marcando a oportunidade como ganha no CRM.",
    to: "/crm",
    cta: "Ir para CRM",
  },
  {
    key: "hasServiceOrder",
    title: "Criar primeira ordem de serviço",
    description: "Organize a execução com checklist, fotos e relatório.",
    to: "/service-orders",
    cta: "Nova OS",
  },
];

const TOUR_KEY = "getting_started_checklist";

export function GettingStartedChecklist() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
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
  const doneCount = status ? ITEMS.filter((i) => status[i.key]).length : 0;
  const total = ITEMS.length;
  const allDone = status ? doneCount === total : false;
  const isCompleted = progress?.status === "COMPLETED" || allDone;
  const isSkipped = progress?.status === "SKIPPED";
  // Effective progress considers persisted current_step so reloads reflect where the user stopped.
  const effectiveDone = isCompleted
    ? total
    : Math.min(total, Math.max(doneCount, progress?.current_step ?? 0));
  const percent = total > 0 ? Math.round((effectiveDone / total) * 100) : 0;

  const completeMutation = useMutation({
    mutationFn: () =>
      upsertProgress({ data: { tourKey: TOUR_KEY, status: "COMPLETED", currentStep: total } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_progress", TOUR_KEY] }),
  });
  const stepMutation = useMutation({
    mutationFn: (step: number) =>
      upsertProgress({ data: { tourKey: TOUR_KEY, status: "IN_PROGRESS", currentStep: step } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_progress", TOUR_KEY] }),
  });

  useEffect(() => {
    if (!status || progress === undefined) return;
    if (progress?.status === "SKIPPED") return;
    let cancelled = false;
    // Defer mutation to next tick so we don't setState on unrelated components
    // (React Query subscribers) while this one is still mounting.
    const t = setTimeout(() => {
      if (cancelled) return;
      if (allDone) {
        if (progress?.status !== "COMPLETED" && !completeMutation.isPending)
          completeMutation.mutate();
      } else if ((progress?.current_step ?? -1) !== doneCount && !stepMutation.isPending) {
        stepMutation.mutate(doneCount);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, progress, doneCount, allDone]);

  if (isSkipped) return null;
  if (isCompleted && !isLoading) return null;

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-primary" />
            Primeiros passos
          </CardTitle>
          {status ? (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {effectiveDone} de {total} concluídos
                </span>
                <span className="font-medium text-foreground">{percent}%</span>
              </div>
              <Progress value={percent} className="h-2" />
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Carregando...</p>
          )}
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
        {(() => {
          const coreDone = CORE_KEYS.every((k) => !!status?.[k]);
          const visibleItems =
            expanded || coreDone ? ITEMS : ITEMS.filter((i) => CORE_KEYS.includes(i.key));
          const hiddenCount = ITEMS.length - visibleItems.length;
          return (
            <>
              {visibleItems.map((it) => {
                const ok = !!status?.[it.key];
                return (
                  <div
                    key={it.key}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border border-border p-3 transition sm:flex-row sm:items-start sm:gap-3",
                      ok && "opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-3 sm:contents">
                      {ok ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-sm font-medium", ok && "line-through")}>
                          {it.title}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{it.description}</p>
                      </div>
                    </div>
                    {!ok && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                      >
                        <Link to={it.to as never}>{it.cta}</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((v) => !v)}
                  className="w-full justify-center gap-1 text-muted-foreground"
                >
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {expanded
                    ? "Mostrar apenas o essencial"
                    : `Ver mais ${hiddenCount} passos avançados`}
                </Button>
              )}
            </>
          );
        })()}
      </CardContent>
    </Card>
  );
}
