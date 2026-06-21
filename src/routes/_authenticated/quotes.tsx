import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute } from "@/components/app/PermissionRoute";

export const Route = createFileRoute("/_authenticated/quotes")({
  head: () => ({ meta: [{ title: "Orçamentos — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="quotes">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Orçamentos" description="Crie e gerencie orçamentos." />
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
      </div>
    </PermissionRoute>
  ),
});
