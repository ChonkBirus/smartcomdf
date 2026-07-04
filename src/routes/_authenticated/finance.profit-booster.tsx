import { createFileRoute } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/finance/profit-booster")({
  head: () => ({ meta: [{ title: "Turbinador de lucros — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Turbinador de lucros"
          description="Simule aumentar vendas, ajustar preço ou reduzir custos e veja o impacto no seu lucro."
        />
        <EmptyState
          icon={<Rocket className="h-6 w-6" />}
          title="Em construção (ETAPA 5)"
          description="Cadastre movimentações financeiras e custos da empresa. O simulador será liberado nas próximas etapas."
        />
      </div>
    </PermissionRoute>
  ),
});
