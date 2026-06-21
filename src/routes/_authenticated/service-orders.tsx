import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";

export const Route = createFileRoute("/_authenticated/service-orders")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — SecureERP" }] }),
  component: () => (
    <FeatureGate feature="service_orders">
      <PermissionRoute module="orders">
        <div className="mx-auto max-w-7xl">
          <PageHeader title="Ordens de Serviço" description="Gestão de OS técnicas." />
          <EmptyState icon={<Wrench className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
        </div>
      </PermissionRoute>
    </FeatureGate>
  ),
});
