import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/service-orders")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — SecureERP" }] }),
  component: () => (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Ordens de Serviço" description="Gestão de OS técnicas." />
      <EmptyState icon={<Wrench className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
    </div>
  ),
});
