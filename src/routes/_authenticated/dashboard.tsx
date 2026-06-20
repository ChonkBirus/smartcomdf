import { createFileRoute } from "@tanstack/react-router";
import { Users, Package, FileText, DollarSign, TrendingUp, Activity } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { KpiCard } from "@/components/app/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SecureERP" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="Visão geral do desempenho da sua empresa."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Clientes" value={formatNumber(124)} icon={<Users className="h-5 w-5" />}
          trend={{ value: "+8% no mês", positive: true }} />
        <KpiCard title="Produtos" value={formatNumber(486)} icon={<Package className="h-5 w-5" />}
          hint="32 com estoque baixo" />
        <KpiCard title="Orçamentos" value={formatNumber(37)} icon={<FileText className="h-5 w-5" />}
          trend={{ value: "+12% no mês", positive: true }} />
        <KpiCard title="Faturamento" value={formatCurrency(86420)} icon={<DollarSign className="h-5 w-5" />}
          trend={{ value: "+5,4% no mês", positive: true }} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="card-elevated lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Atividade recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Os módulos de Produtos, Clientes, Orçamentos e demais serão liberados em breve.
              Os indicadores acima são demonstrativos.
            </p>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Status do sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
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
