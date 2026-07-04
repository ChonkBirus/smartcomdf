import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FinancePage } from "@/components/finance/FinancePage";

export const Route = createFileRoute("/_authenticated/finance/settings")({
  head: () => ({ meta: [{ title: "Configurações financeiras — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <FinancePage defaultTab="categories" />
    </PermissionRoute>
  ),
});
