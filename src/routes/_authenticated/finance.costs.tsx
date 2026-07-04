import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { CostsPage } from "@/components/finance/CostsPage";

export const Route = createFileRoute("/_authenticated/finance/costs")({
  head: () => ({ meta: [{ title: "Custos da empresa — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance" action="view">
      <CostsPage />
    </PermissionRoute>
  ),
});
