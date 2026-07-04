import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FinancePage } from "@/components/finance/FinancePage";

export const Route = createFileRoute("/_authenticated/finance/reports")({
  head: () => ({ meta: [{ title: "Relatórios financeiros — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <FinancePage defaultTab="reports" />
    </PermissionRoute>
  ),
});
