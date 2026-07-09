import type { FinancialTransaction } from "./finance.functions";

export type TxOriginInfo = {
  label: string;
  badgeLabel: string;
  href?: string;
  description?: string;
};

/**
 * Central helper that resolves the human-readable origin of a
 * financial transaction, along with an in-app link when available.
 *
 * Priority:
 *   1. explicit origin_type (from PR1/PR4 migrations)
 *   2. legacy heuristics based on foreign keys (quote/purchase/project/OS)
 *   3. generic "Manual"
 */
export function getTxOriginLabel(t: Partial<FinancialTransaction>): TxOriginInfo {
  const type = (t.origin_type ?? "").toUpperCase();

  switch (type) {
    case "QUOTE_PAYMENT":
      return {
        label: "Pagamento de orçamento",
        badgeLabel: "Orçamento",
        href: t.quote_id ? `/quotes/${t.quote_id}` : undefined,
        description: "Entrada recebida na aprovação do orçamento.",
      };
    case "QUOTE_RECEIVABLE_BALANCE":
      return {
        label: "Saldo de orçamento",
        badgeLabel: "Orçamento (saldo)",
        href: t.quote_id ? `/quotes/${t.quote_id}` : undefined,
        description: "Saldo a receber gerado a partir do orçamento.",
      };
    case "PURCHASE_ORDER_PAYABLE":
      return {
        label: "Pedido de compra",
        badgeLabel: "Compra",
        href: t.purchase_id ? `/purchases` : undefined,
        description: "Conta a pagar vinculada a um pedido de compra.",
      };
    case "STOCK_PURCHASE":
      return {
        label: "Compra de estoque",
        badgeLabel: "Estoque",
        href: t.purchase_id ? `/purchases` : undefined,
      };
    case "SERVICE_ORDER_COST":
      return {
        label: "Custo de OS",
        badgeLabel: "OS",
        href: t.service_order_id ? `/service-orders/${t.service_order_id}` : undefined,
      };
    case "PROJECT_COST":
      return {
        label: "Custo de projeto",
        badgeLabel: "Projeto",
        href: t.project_id ? `/projects/${t.project_id}` : undefined,
      };
    case "MANUAL":
      return { label: "Manual", badgeLabel: "Manual" };
  }

  // Legacy fallback (rows that predate origin_type)
  if (t.quote_id) {
    return {
      label: "Orçamento",
      badgeLabel: "Orçamento",
      href: `/quotes/${t.quote_id}`,
    };
  }
  if (t.purchase_id) {
    return {
      label: "Pedido de compra",
      badgeLabel: "Compra",
      href: `/purchases`,
    };
  }
  if (t.service_order_id) {
    return {
      label: "Ordem de serviço",
      badgeLabel: "OS",
      href: `/service-orders/${t.service_order_id}`,
    };
  }
  if (t.project_id) {
    return {
      label: "Projeto",
      badgeLabel: "Projeto",
      href: `/projects/${t.project_id}`,
    };
  }

  return { label: "Manual", badgeLabel: "Manual" };
}
