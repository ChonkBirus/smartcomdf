import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, Lock } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/permissions";
import { ReportsFilters, type ReportsFiltersValue } from "@/components/reports/ReportsFilters";
import { ReportsOverview } from "@/components/reports/ReportsOverview";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — SmartCom Pro" }] }),
  component: ReportsPage,
});

const DEFAULT_FILTERS: ReportsFiltersValue = { period: "30d", from: null, to: null };

function ReportsPage() {
  const { has } = usePermissions();
  const [filters, setFilters] = useState<ReportsFiltersValue>(DEFAULT_FILTERS);

  const canFinancial = has("reports.financial");

  const placeholder = (title: string) => (
    <EmptyState
      icon={<BarChart3 className="h-6 w-6" />}
      title={`Relatório de ${title}`}
      description="Esta aba será liberada em breve. Os indicadores principais estão na aba Visão Geral."
    />
  );

  return (
    <PermissionRoute module="reports">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Relatórios"
          description="Indicadores reais da sua operação para apoiar decisões."
        />

        <ReportsFilters
          value={filters}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="commercial">Comercial</TabsTrigger>
            <TabsTrigger value="quotes">Orçamentos</TabsTrigger>
            <TabsTrigger value="projects">Projetos</TabsTrigger>
            <TabsTrigger value="service_orders">Ordens de Serviço</TabsTrigger>
            <TabsTrigger value="stock">Estoque</TabsTrigger>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="technicians">Técnicos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <ReportsOverview filters={filters} />
          </TabsContent>
          <TabsContent value="commercial" className="mt-4">{placeholder("Comercial")}</TabsContent>
          <TabsContent value="quotes" className="mt-4">{placeholder("Orçamentos")}</TabsContent>
          <TabsContent value="projects" className="mt-4">{placeholder("Projetos")}</TabsContent>
          <TabsContent value="service_orders" className="mt-4">{placeholder("Ordens de Serviço")}</TabsContent>
          <TabsContent value="stock" className="mt-4">{placeholder("Estoque")}</TabsContent>
          <TabsContent value="customers" className="mt-4">{placeholder("Clientes")}</TabsContent>
          <TabsContent value="financial" className="mt-4">
            {canFinancial ? (
              placeholder("Financeiro básico")
            ) : (
              <EmptyState
                icon={<Lock className="h-6 w-6" />}
                title="Acesso restrito"
                description="Esta aba exige a permissão reports.financial. Solicite acesso ao proprietário da conta."
              />
            )}
          </TabsContent>
          <TabsContent value="technicians" className="mt-4">{placeholder("Técnicos")}</TabsContent>
        </Tabs>
      </div>
    </PermissionRoute>
  );
}
