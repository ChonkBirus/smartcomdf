import { createFileRoute } from "@tanstack/react-router";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { PlanningPage } from "@/components/finance/PlanningPage";

export const Route = createFileRoute("/_authenticated/finance/planning")({
  head: () => ({ meta: [{ title: "Planejamento financeiro — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance" action="view">
      <PlanningPage />
    </PermissionRoute>
  ),
});
