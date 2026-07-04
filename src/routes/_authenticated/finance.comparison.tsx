import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { ComparisonPage } from "@/components/finance/ComparisonPage";

const presetSchema = z.enum(["this_month", "this_year", "last_30", "last_90", "custom"]);
const searchSchema = z.object({
  preset: presetSchema.optional(),
  aFrom: z.string().optional(),
  aTo: z.string().optional(),
  bFrom: z.string().optional(),
  bTo: z.string().optional(),
});

export type ComparisonSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_authenticated/finance/comparison")({
  head: () => ({ meta: [{ title: "Comparativo financeiro — SmartPro" }] }),
  validateSearch: (raw: Record<string, unknown>): ComparisonSearch => {
    const parsed = searchSchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
  },
  component: () => (
    <PermissionRoute module="finance" action="view">
      <ComparisonPage />
    </PermissionRoute>
  ),
});
