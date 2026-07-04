import { createFileRoute, Link } from "@tanstack/react-router";
import { Percent } from "lucide-react";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/finance/pricing")({
  head: () => ({ meta: [{ title: "Precificação e markup — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Precificação e markup"
          description="Fórmula do markup, defaults por empresa e sugestão de preço para produtos e serviços."
        />
        <EmptyState
          icon={<Percent className="h-6 w-6" />}
          title="Configurações de precificação"
          description="Acesse as configurações completas de custos, pró-labore, margem desejada e simulador de preço."
          action={
            <Button asChild>
              <Link to="/finance/pricing/settings">Abrir configurações</Link>
            </Button>
          }
        />
      </div>
    </PermissionRoute>
  ),
});
