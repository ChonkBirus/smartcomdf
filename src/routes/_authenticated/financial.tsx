import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute } from "@/components/app/PermissionRoute";

export const Route = createFileRoute("/_authenticated/financial")({
  head: () => ({ meta: [{ title: "Financeiro — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="financial">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Financeiro" description="Contas a pagar e receber." />
        <EmptyState icon={<DollarSign className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
      </div>
    </PermissionRoute>
  ),
});
