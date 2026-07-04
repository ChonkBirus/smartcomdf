import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { PricingSimulatorPage } from "@/components/finance/PricingSimulatorPage";

export const Route = createFileRoute("/_authenticated/finance/pricing")({
  head: () => ({ meta: [{ title: "Precificação e markup — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance" action="view">
      <PricingSimulatorPage />
    </PermissionRoute>
  ),
});
