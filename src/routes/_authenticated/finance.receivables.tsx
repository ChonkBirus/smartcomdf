import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FinancePage } from "@/components/finance/FinancePage";

export const Route = createFileRoute("/_authenticated/finance/receivables")({
  head: () => ({ meta: [{ title: "Contas a receber — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <FinancePage defaultTab="receivables" />
    </PermissionRoute>
  ),
});
