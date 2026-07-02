import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HeartHandshake, TrendingUp, Trophy, Flame, AlarmClock } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmBoard } from "@/components/crm/CrmBoard";
import { CrmReportsPanel } from "@/components/crm/CrmReportsPanel";
import { getCrmOverview } from "@/lib/crm.functions";

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
              <TabsTrigger value="reports">Relatórios</TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="mt-4">
              <CrmBoard />
            </TabsContent>

            <TabsContent value="overview" className="mt-4">
              <OverviewGrid />
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
  const fetchOverview = useServerFn(getCrmOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "overview"],
    queryFn: () => fetchOverview(),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const metrics = [
    { icon: HeartHandshake, label: "Leads em aberto", value: `${data.open}`, hint: brl(data.openValue) },
    { icon: Trophy, label: "Ganhos (30d)", value: `${data.won30d}`, hint: brl(data.wonValue30d) },
    { icon: TrendingUp, label: "Conversão (30d)", value: `${data.conversion30d.toFixed(1)}%`, hint: `${data.lost30d} perdidos` },
    { icon: AlarmClock, label: "Follow-ups atrasados", value: `${data.overdueFollowUps}`, hint: `${data.total} leads no total` },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
  );
}
