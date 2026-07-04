import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FinancePage } from "@/components/finance/FinancePage";

export const Route = createFileRoute("/_authenticated/finance/dashboard")({
  head: () => ({ meta: [{ title: "Painel financeiro — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <FinancePage defaultTab="overview" />
    </PermissionRoute>
  ),
});
