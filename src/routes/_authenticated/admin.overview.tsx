import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  Receipt,
  TrendingUp,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminBillingOverview } from "@/lib/billing-overview.functions";

export const Route = createFileRoute("/_authenticated/admin/overview")({
  head: () => ({ meta: [{ title: "Visão Geral — Admin SaaS" }] }),
  component: OverviewPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Metric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneCls = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function OverviewPage() {
  const fetchOverview = useServerFn(getAdminBillingOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "billing-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Building2} label="Empresas totais" value={data.totalCompanies} />
        <Metric icon={Sparkles} label="Em trial" value={data.trialingCount} />
        <Metric icon={CheckCircle2} label="Ativas" value={data.activeCount} tone="success" />
        <Metric
          icon={AlertCircle}
          label="Pagamento pendente"
          value={data.pastDueCount}
          tone="warning"
        />
        <Metric icon={PauseCircle} label="Suspensas" value={data.suspendedCount} tone="danger" />
        <Metric
          icon={Receipt}
          label="Pagamentos no mês"
          value={`${data.paymentsThisMonthCount} · ${brl(data.paymentsThisMonthAmount)}`}
        />
        <Metric icon={TrendingUp} label="MRR estimado" value={brl(data.mrr)} tone="success" />
        <Metric icon={TrendingUp} label="ARR estimado" value={brl(data.arr)} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" /> Trials vencendo nos próximos 3 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.trialsEndingSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum trial vencendo.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.trialsEndingSoon.map((t) => (
                  <li key={t.subscription_id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{t.company_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{t.plan_name ?? "—"}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.trial_ends_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Saúde do billing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Webhooks com erro</span>
              <span className={data.webhooksErrorCount > 0 ? "font-semibold text-destructive" : ""}>
                {data.webhooksErrorCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Em análise manual</span>
              <span>{data.manualReviewCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Canceladas</span>
              <span>{data.canceledCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expiradas</span>
              <span>{data.expiredCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
