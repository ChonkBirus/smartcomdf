import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users, Package, FileText, DollarSign, TrendingUp, Activity,
  PackageX, AlertTriangle, Boxes, CheckCircle2, Clock, PercentCircle,
  FolderKanban, Wrench, Wallet, BarChart3,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCompanyId } from "@/hooks/use-company-id";
import { PageHeader } from "@/components/app/PageHeader";
import { KpiCard } from "@/components/app/KpiCard";
import { SubscriptionCard } from "@/components/app/SubscriptionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { stockOverview } from "@/lib/stock.functions";
import { getReportsOverview } from "@/lib/reports.functions";
import { usePermissions } from "@/lib/permissions";
import { useFeatures } from "@/lib/features";
import { GettingStartedChecklist } from "@/components/onboarding/GettingStartedChecklist";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmartCom Pro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { canView } = usePermissions();
  const { hasFeature } = useFeatures();
  const showStock = canView("stock") && hasFeature("inventory");
  const companyId = useCompanyId();

  const fetchOverview = useServerFn(getReportsOverview);
  const fetchStock = useServerFn(stockOverview);

  const metrics = useQuery({
    queryKey: ["dashboard-metrics", companyId],
    queryFn: () => fetchOverview({ data: {} }),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const stockQ = useQuery({
    queryKey: ["dashboard-stock", companyId],
    queryFn: () => fetchStock(),
    enabled: showStock && !!companyId,
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="Visão geral do desempenho da sua empresa."
        tourKey="initial"
      />

      <div className="mb-6">
        <GettingStartedChecklist />
      </div>

      {metrics.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : metrics.isError ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Erro ao carregar indicadores"
          description={metrics.error instanceof Error ? metrics.error.message : "Tente novamente em alguns instantes."}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Clientes" value={String(metrics.data!.cards.customersTotal)} icon={<Users className="h-5 w-5" />} />
            <KpiCard title="Orçamentos" value={String(metrics.data!.cards.quotesTotal)} icon={<FileText className="h-5 w-5" />} hint={`${metrics.data!.cards.quotesPending} pendentes`} />
            <KpiCard title="Aprovados" value={String(metrics.data!.cards.quotesApproved)} icon={<CheckCircle2 className="h-5 w-5" />} />
            <KpiCard title="Valor aprovado" value={formatCurrency(metrics.data!.cards.valueAprovado)} icon={<DollarSign className="h-5 w-5" />} />
            <KpiCard title="Taxa de conversão" value={`${metrics.data!.cards.conversionRate.toFixed(1)}%`} icon={<PercentCircle className="h-5 w-5" />} />
            <KpiCard title="Projetos ativos" value={String(metrics.data!.cards.projectsActive)} icon={<FolderKanban className="h-5 w-5" />} />
            <KpiCard title="OS abertas" value={String(metrics.data!.cards.osOpen)} icon={<Wrench className="h-5 w-5" />} />
            <KpiCard title="Pagamentos pendentes" value={String(metrics.data!.cards.pendingPayments)} icon={<Wallet className="h-5 w-5" />} />
          </div>

          <Card className="card-elevated mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Orçamentos por status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.data!.charts.quotesByStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado para exibir. Cadastre clientes, produtos e orçamentos para visualizar dados reais aqui.
                </p>
              ) : (
                <div className="space-y-2">
                  {metrics.data!.charts.quotesByStatus.map((row) => {
                    const max = Math.max(...metrics.data!.charts.quotesByStatus.map((r) => r.count));
                    const pct = max ? (row.count / max) * 100 : 0;
                    return (
                      <div key={row.status}>
                        <div className="flex justify-between text-xs">
                          <span className="font-medium capitalize">{row.status}</span>
                          <span className="text-muted-foreground">{row.count}</span>
                        </div>
                        <div className="mt-1 h-2 rounded bg-muted">
                          <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {showStock && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <KpiCard title="Itens sem estoque" value={String(stockQ.data?.outOfStock ?? 0)} icon={<PackageX className="h-5 w-5" />} />
          <KpiCard title="Abaixo do mínimo" value={String(stockQ.data?.lowStock ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} />
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-4 w-4 text-primary" /> Últimas movimentações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {(stockQ.data?.recent ?? []).length === 0 ? (
                <p className="text-muted-foreground">Nenhuma movimentação recente.</p>
              ) : (
                stockQ.data!.recent.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{r.item_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.movement_type} · {r.quantity}
                    </span>
                  </div>
                ))
              )}
              <div className="pt-2">
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/stock">Abrir estoque</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="card-elevated lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Próximos passos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Use o menu lateral para cadastrar clientes, produtos, orçamentos, projetos e ordens de serviço.</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" variant="outline"><Link to="/clients">Clientes</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/products">Produtos</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/quotes">Orçamentos</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/service-orders">Ordens de Serviço</Link></Button>
            </div>
          </CardContent>
        </Card>
        <SubscriptionCard />
      </div>

      <div className="mt-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Status do sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Banco de dados</span>
              <span className="text-success font-medium">Operacional</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Autenticação</span>
              <span className="text-success font-medium">Operacional</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Armazenamento</span>
              <span className="text-success font-medium">Operacional</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
