import { createFileRoute } from "@tanstack/react-router";
import { GitCompare } from "lucide-react";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/finance/comparison")({
  head: () => ({ meta: [{ title: "Comparativo financeiro — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Comparativo financeiro"
          description="Compare receitas, despesas, lucro e margem entre períodos, projetos ou centros de custo."
        />
        <EmptyState
          icon={<GitCompare className="h-6 w-6" />}
          title="Em construção (ETAPA 3)"
          description="Selecione dois períodos, centros de custo ou projetos para comparar seus resultados. Este módulo será liberado na próxima etapa."
        />
      </div>
    </PermissionRoute>
  ),
});
