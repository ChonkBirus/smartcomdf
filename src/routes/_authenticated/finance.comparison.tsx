import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { ComparisonPage } from "@/components/finance/ComparisonPage";

const searchSchema = z.object({
  preset: fallback(z.enum(["this_month", "this_year", "last_30", "last_90", "custom"]), "this_month").default("this_month"),
  aFrom: fallback(z.string().optional(), undefined),
  aTo: fallback(z.string().optional(), undefined),
  bFrom: fallback(z.string().optional(), undefined),
  bTo: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/finance/comparison")({
  head: () => ({ meta: [{ title: "Comparativo financeiro — SmartPro" }] }),
  validateSearch: zodValidator(searchSchema),
  component: () => (
    <PermissionRoute module="finance" action="view">
      <ComparisonPage />
    </PermissionRoute>
  ),
});
