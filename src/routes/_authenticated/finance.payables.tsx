import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FinancePage } from "@/components/finance/FinancePage";

export const Route = createFileRoute("/_authenticated/finance/payables")({
  head: () => ({ meta: [{ title: "Contas a pagar — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance">
      <FinancePage defaultTab="payables" />
    </PermissionRoute>
  ),
});
