import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getServiceOrderFinancialSummary } from "@/lib/finance-integrations.functions";
import { usePermissions } from "@/lib/permissions";
import { FinancialSummaryCard } from "./FinancialSummaryCard";

export function ServiceOrderFinancialSummary({ serviceOrderId }: { serviceOrderId: string }) {
  const { has } = usePermissions();
  const fn = useServerFn(getServiceOrderFinancialSummary);
  const canView = has("finance.view") || has("finance.manage");
  const showCosts = has("finance.view_costs") || has("finance.manage");

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "summary", "so", serviceOrderId],
    queryFn: () => fn({ data: { service_order_id: serviceOrderId } }),
    enabled: canView,
  });

  if (!canView) return null;
  return (
    <FinancialSummaryCard
      summary={data}
      loading={isLoading}
      title="Financeiro vinculado"
      showCosts={showCosts}
      emptyHint="Sem vínculo financeiro para esta OS."
    />
  );
}
