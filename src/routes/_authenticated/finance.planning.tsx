import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/finance/planning")({
  head: () => ({ meta: [{ title: "Planejamento financeiro — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Planejamento financeiro"
          description="Metas de faturamento, lucro, margem, caixa mínimo e limites de despesa."
        />
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Em construção (ETAPA 4)"
          description="Aqui você definirá metas e acompanhará realizado x planejado. Módulo liberado na próxima etapa."
        />
      </div>
    </PermissionRoute>
  ),
});
