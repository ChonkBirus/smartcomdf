import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Produtos — SecureERP" }] }),
  component: () => (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Produtos" description="Catálogo de produtos da sua empresa." />
      <EmptyState icon={<Package className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
    </div>
  ),
});
