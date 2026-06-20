import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Estoque — SecureERP" }] }),
  component: () => (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Estoque" description="Controle de estoque." />
      <EmptyState icon={<Boxes className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
    </div>
  ),
});
