import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  HeartHandshake,
  TrendingUp,
  Trophy,
  AlarmClock,
  Wallet,
  Target,
  Timer,
  Flame,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmBoard } from "@/components/crm/CrmBoard";
import { CrmReportsPanel } from "@/components/crm/CrmReportsPanel";
import { CrmChurnRiskPanel } from "@/components/crm/CrmChurnRiskPanel";
import { getCrmDashboardKpis } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — SMARTPRO" }] }),
  component: CrmPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CrmPage() {
  return (
    <FeatureGate feature="crm">
      <PermissionRoute module="crm">
        <div className="mx-auto max-w-7xl">
          <PageHeader
            title="CRM"
            description="Funil de vendas e relacionamento no estilo Kanban."
            tourKey="crm"
          />

          <Tabs defaultValue="board" className="w-full">
            <TabsList>
              <TabsTrigger value="board">Funil</TabsTrigger>
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="risk">Riscos</TabsTrigger>
              <TabsTrigger value="reports">Relatórios</TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="mt-4">
              <CrmBoard />
            </TabsContent>

            <TabsContent value="overview" className="mt-4">
              <OverviewGrid />
            </TabsContent>

            <TabsContent value="risk" className="mt-4">
              <CrmChurnRiskPanel />
            </TabsContent>

            <TabsContent value="reports" className="mt-4">
              <CrmReportsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </PermissionRoute>
    </FeatureGate>
  );
}

function OverviewGrid() {
  const fetchKpis = useServerFn(getCrmDashboardKpis);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "kpis"],
    queryFn: () => fetchKpis(),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const metrics = [
    {
      icon: HeartHandshake,
      label: "Pipeline aberto",
      value: `${data.pipelineOpen.count}`,
      hint: brl(data.pipelineOpen.value),
    },
    {
      icon: Trophy,
      label: "Ganhos (30d)",
      value: `${data.won30d.count}`,
      hint: brl(data.won30d.value),
    },
    {
      icon: TrendingUp,
      label: "Conversão (30d)",
      value: `${data.conversion30d.toFixed(1)}%`,
      hint: `${data.lost30d.count} perdidos`,
    },
    {
      icon: Wallet,
      label: "Ticket médio (30d)",
      value: brl(data.avgTicket30d),
      hint: "Média por venda ganha",
    },
    {
      icon: Target,
      label: "Forecast ponderado",
      value: brl(data.forecast),
      hint: "Pipeline × temperatura",
    },
    {
      icon: Timer,
      label: "Ciclo médio",
      value: data.avgCycleDays == null ? "—" : `${data.avgCycleDays.toFixed(1)}d`,
      hint: "Ganhas nos últimos 90d",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{m.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{m.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <AlarmClock className="mr-2 inline h-4 w-4 text-primary" />
              Pipeline por etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byStage.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem oportunidades abertas.</p>
            )}
            {data.byStage.map((s) => (
              <StageBar
                key={s.stage_id}
                name={s.name}
                color={s.color}
                count={s.count}
                value={s.value}
                total={data.pipelineOpen.value || 1}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <Flame className="mr-2 inline h-4 w-4 text-primary" />
              Temperatura do funil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byTemperature.map((t) => (
              <StageBar
                key={t.key}
                name={t.label}
                color={null}
                count={t.count}
                value={t.value}
                total={data.pipelineOpen.value || 1}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StageBar({
  name,
  color,
  count,
  value,
  total,
}: {
  name: string;
  color: string | null;
  count: number;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: color ?? "hsl(var(--primary))" }}
          />
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground">({count})</span>
        </span>
        <span className="font-medium">{brl(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
