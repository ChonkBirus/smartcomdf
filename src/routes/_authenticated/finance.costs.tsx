import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/finance/costs")({
  head: () => ({ meta: [{ title: "Custos da empresa — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Custos da empresa"
          description="Faturamento, custos fixos, operacionais, variáveis, pró-labore e margem desejada."
        />
        <EmptyState
          icon={<Calculator className="h-6 w-6" />}
          title="Em construção (ETAPA 2)"
          description="Enquanto isso, você já pode configurar custos e margem em Precificação."
          action={
            <Button asChild>
              <Link to="/finance/pricing/settings">Abrir configurações de precificação</Link>
            </Button>
          }
        />
      </div>
    </PermissionRoute>
  ),
});
