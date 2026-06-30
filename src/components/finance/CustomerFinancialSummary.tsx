import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerFinancialSummary } from "@/lib/finance-integrations.functions";
import { usePermissions } from "@/lib/permissions";
import { FinancialSummaryCard } from "./FinancialSummaryCard";

export function CustomerFinancialSummary({ customerId }: { customerId: string }) {
  const { has } = usePermissions();
  const fn = useServerFn(getCustomerFinancialSummary);
  const canView = has("finance.view") || has("finance.manage");

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "summary", "customer", customerId],
    queryFn: () => fn({ data: { customer_id: customerId } }),
    enabled: canView,
  });

  if (!canView) return null;
  return (
    <FinancialSummaryCard
      summary={data}
      loading={isLoading}
      title="Resumo financeiro do cliente"
      emptyHint="Nenhuma movimentação financeira vinculada a este cliente."
    />
  );
}
