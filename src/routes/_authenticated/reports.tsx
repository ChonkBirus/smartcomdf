import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute } from "@/components/app/PermissionRoute";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="reports">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Relatórios" description="Análises e indicadores." />
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
      </div>
    </PermissionRoute>
  ),
});
