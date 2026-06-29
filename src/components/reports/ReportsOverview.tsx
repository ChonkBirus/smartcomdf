import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, CheckCircle2, Clock, FileText, Wallet, Users, FolderKanban,
  Wrench, AlertTriangle, CircleDollarSign, PercentCircle, TrendingUp,
} from "lucide-react";
import { KpiCard } from "@/components/app/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/app/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { getReportsOverview } from "@/lib/reports.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import type { ReportsFiltersValue } from "./ReportsFilters";
import { resolvePeriod } from "./ReportsFilters";

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function ReportsOverview({ filters }: { filters: ReportsFiltersValue }) {
  const { from, to } = resolvePeriod(filters.period, filters.from, filters.to);
  const companyId = useCompanyId();
  const q = useQuery({
    queryKey: ["reports", "overview", companyId, filters.period, from, to],
    queryFn: () => getReportsOverview({ data: { from, to } }),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Erro ao carregar"
        description={q.error instanceof Error ? q.error.message : "Tente novamente."}
      />
    );
  }

  const data = q.data!;
  const noData =
    data.cards.quotesTotal === 0 &&
    data.cards.customersTotal === 0 &&
    data.cards.osOpen === 0 &&
    data.cards.osDone === 0;

  if (noData) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title="Nenhum dado encontrado"
        description="Não encontramos informações para os filtros selecionados. Ajuste o período ou cadastre novos registros para gerar relatórios."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Orçamentos" value={data.cards.quotesTotal} icon={<FileText className="h-5 w-5" />} />
        <KpiCard title="Aprovados" value={data.cards.quotesApproved} icon={<CheckCircle2 className="h-5 w-5" />} />
        <KpiCard title="Pendentes" value={data.cards.quotesPending} icon={<Clock className="h-5 w-5" />} />
        <KpiCard
          title="Taxa de conversão"
          value={`${data.cards.conversionRate.toFixed(1)}%`}
          icon={<PercentCircle className="h-5 w-5" />}
        />
        <KpiCard title="Valor orçado" value={brl(data.cards.valueOrcado)} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard title="Valor aprovado" value={brl(data.cards.valueAprovado)} icon={<CircleDollarSign className="h-5 w-5" />} />
        <KpiCard title="Clientes" value={data.cards.customersTotal} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Projetos ativos" value={data.cards.projectsActive} icon={<FolderKanban className="h-5 w-5" />} />
        <KpiCard title="OS abertas" value={data.cards.osOpen} icon={<Wrench className="h-5 w-5" />} />
        <KpiCard title="OS concluídas" value={data.cards.osDone} icon={<CheckCircle2 className="h-5 w-5" />} />
        <KpiCard title="Estoque baixo" value={data.cards.lowStock} icon={<AlertTriangle className="h-5 w-5" />} />
        <KpiCard title="Pagamentos pendentes" value={data.cards.pendingPayments} icon={<Wallet className="h-5 w-5" />} />
      </div>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base">Orçamentos por status</CardTitle>
        </CardHeader>
        <CardContent>
          {data.charts.quotesByStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem orçamentos no período.</p>
          ) : (
            <div className="space-y-2">
              {data.charts.quotesByStatus.map((row) => {
                const max = Math.max(...data.charts.quotesByStatus.map((r) => r.count));
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
    </div>
  );
}
