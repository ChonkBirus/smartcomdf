import { createFileRoute } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — SecureERP" }] }),
  component: () => (
    <FeatureGate feature="crm">
      <PermissionRoute module="crm">
        <div className="mx-auto max-w-7xl">
          <PageHeader title="CRM" description="Funil de vendas e relacionamento." />
          <EmptyState icon={<HeartHandshake className="h-6 w-6" />} title="Em breve" description="Este módulo será liberado em breve." />
        </div>
      </PermissionRoute>
    </FeatureGate>
  ),
});
