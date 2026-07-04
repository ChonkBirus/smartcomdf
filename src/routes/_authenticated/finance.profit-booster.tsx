import { createFileRoute } from "@tanstack/react-router";
import { ProfitBoosterPage } from "@/components/finance/ProfitBoosterPage";

export const Route = createFileRoute("/_authenticated/finance/profit-booster")({
  head: () => ({ meta: [{ title: "Turbinador de Lucros — SmartPro" }] }),
  component: ProfitBoosterPage,
});
