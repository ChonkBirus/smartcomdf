import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FinancePage } from "@/components/finance/FinancePage";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Financeiro — SmartCom Pro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <FinancePage />
    </PermissionRoute>
  ),
});
