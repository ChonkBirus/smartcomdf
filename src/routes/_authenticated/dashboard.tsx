import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  Users, FileText, DollarSign, TrendingUp, Activity,
  PackageX, AlertTriangle, Boxes, CheckCircle2, PercentCircle,
  FolderKanban, Wrench, Wallet, BarChart3,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCompanyContext } from "@/hooks/use-company-id";
import { PageHeader } from "@/components/app/PageHeader";
import { KpiCard } from "@/components/app/KpiCard";
import { SubscriptionCard } from "@/components/app/SubscriptionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { getDashboardMetrics, emptyDashboardMetrics } from "@/lib/dashboard.functions";
import { usePermissions } from "@/lib/permissions";
import { useFeatures } from "@/lib/features";
import { GettingStartedChecklist } from "@/components/onboarding/GettingStartedChecklist";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmartPro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { canView } = usePermissions();
  const { hasFeature } = useFeatures();
  const showStock = canView("stock") && hasFeature("inventory");
  const companyContext = useCompanyContext();
  const companyId = companyContext.companyId;
  const dashboardFilters = useMemo(() => ({ from: null, to: null }), []);

  const fetchDashboard = useServerFn(getDashboardMetrics);

  const metrics = useQuery({
    queryKey: ["dashboard-metrics", companyId, dashboardFilters],
    queryFn: () => fetchDashboard({ data: dashboardFilters }),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[DASHBOARD] user:", (companyContext.data as any)?.profile?.id);
    console.log("[DASHBOARD] companyId:", companyId);
    console.log("[DASHBOARD] filters:", dashboardFilters);
    console.log("[DASHBOARD] metrics response:", metrics.data);
    if (metrics.error) console.error("[DASHBOARD ERROR]", metrics.error);
  }, [companyContext.data, companyId, metrics.data, metrics.error]);

  const rawData = metrics.data;
  const data = {
    customers: { ...emptyDashboardMetrics.customers, ...(rawData?.customers ?? {}) },
    quotes: { ...emptyDashboardMetrics.quotes, ...(rawData?.quotes ?? {}) },
    projects: { ...emptyDashboardMetrics.projects, ...(rawData?.projects ?? {}) },
    serviceOrders: { ...emptyDashboardMetrics.serviceOrders, ...(rawData?.serviceOrders ?? {}) },
    stock: { ...emptyDashboardMetrics.stock, ...(rawData?.stock ?? {}) },
    payments: { ...emptyDashboardMetrics.payments, ...(rawData?.payments ?? {}) },
    recentActivity: rawData?.recentActivity ?? emptyDashboardMetrics.recentActivity,
    charts: {
      quotesByStatus: rawData?.charts?.quotesByStatus ?? emptyDashboardMetrics.charts.quotesByStatus,
    },
  };
  const openServiceOrders = Math.max(0, (data.serviceOrders.total ?? 0) - (data.serviceOrders.completed ?? 0));

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

      {companyContext.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !companyId ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Nenhuma empresa ativa encontrada"
          description="Não foi possível identificar a empresa vinculada ao seu usuário. Verifique seu cadastro ou fale com o suporte."
        />
      ) : metrics.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : metrics.isError ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Não foi possível carregar o dashboard"
          description="Houve um erro ao buscar os dados reais da sua empresa. Tente novamente em instantes."
          action={<Button onClick={() => metrics.refetch()} variant="outline">Tentar novamente</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Clientes" value={String(data.customers.total ?? 0)} icon={<Users className="h-5 w-5" />} />
            <KpiCard title="Orçamentos" value={String(data.quotes.total ?? 0)} icon={<FileText className="h-5 w-5" />} hint={`${data.quotes.pending ?? 0} pendentes`} />
            <KpiCard title="Aprovados" value={String(data.quotes.approved ?? 0)} icon={<CheckCircle2 className="h-5 w-5" />} />
            <KpiCard title="Valor aprovado" value={formatCurrency(data.quotes.approvedAmount ?? 0)} icon={<DollarSign className="h-5 w-5" />} />
            <KpiCard title="Taxa de conversão" value={`${(data.quotes.conversionRate ?? 0).toFixed(1)}%`} icon={<PercentCircle className="h-5 w-5" />} />
            <KpiCard title="Projetos ativos" value={String(data.projects.active ?? 0)} icon={<FolderKanban className="h-5 w-5" />} />
            <KpiCard title="OS abertas" value={String(openServiceOrders)} icon={<Wrench className="h-5 w-5" />} />
            <KpiCard title="Pagamentos pendentes" value={String(data.payments.waiting ?? 0)} icon={<Wallet className="h-5 w-5" />} />
          </div>

          <Card className="card-elevated mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Orçamentos por status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data.charts.quotesByStatus ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado para exibir. Cadastre clientes, produtos e orçamentos para visualizar dados reais aqui.
                </p>
              ) : (
                <div className="space-y-2">
                  {(data.charts.quotesByStatus ?? []).map((row) => {
                    const max = Math.max(...(data.charts.quotesByStatus ?? []).map((r) => r.count));
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

      {showStock && !!companyId && !metrics.isLoading && !metrics.isError && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <KpiCard title="Itens sem estoque" value={String(data.stock.outOfStock ?? 0)} icon={<PackageX className="h-5 w-5" />} />
          <KpiCard title="Abaixo do mínimo" value={String(data.stock.lowStock ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} />
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-4 w-4 text-primary" /> Movimentações de estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {(data.stock.recentMovements ?? 0) === 0 ? (
                <p className="text-muted-foreground">Nenhuma movimentação recente.</p>
              ) : (
                <p className="text-muted-foreground">{data.stock.recentMovements} movimentações registradas.</p>
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

      {companyId && !metrics.isLoading && !metrics.isError && (
      <div className="mt-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Atividade recente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(data.recentActivity ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhuma atividade real registrada para esta empresa.</p>
            ) : (
              (data.recentActivity ?? []).map((activity) => (
                <div key={activity.id} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{activity.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {activity.created_at ? new Date(activity.created_at).toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
