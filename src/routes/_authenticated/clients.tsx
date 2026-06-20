import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clientes — SecureERP" }] }),
  component: () => (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Clientes" description="Gestão de clientes." />
      <EmptyState icon={<Users className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
    </div>
  ),
});
