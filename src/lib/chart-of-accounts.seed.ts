// Default chart of accounts for Smart Pro (server-side only source of truth).
// Referenced by the ensureDefaultChartOfAccounts server function.

import type { CategoryGroup, CostBehavior, FinTxType } from "@/lib/finance.functions";

export type ChartOfAccountsSeedNode = {
  code: string;
  name: string;
  type: FinTxType;
  category_group: CategoryGroup;
  cost_behavior?: CostBehavior;
};

/**
 * Ordered flat list of the standard chart of accounts.
 * Level and parent are derived from `code` at seed/read time.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: readonly ChartOfAccountsSeedNode[] = [
  // 3 — Receita / Faturamento
  { code: "3",       name: "Receita / Faturamento",   type: "INCOME", category_group: "REVENUE" },
  { code: "3.1",     name: "Receita de vendas",       type: "INCOME", category_group: "REVENUE" },
  { code: "3.1.1",   name: "Vendas em dinheiro",      type: "INCOME", category_group: "REVENUE" },
  { code: "3.1.2",   name: "Vendas cartões de débito",type: "INCOME", category_group: "REVENUE" },
  { code: "3.1.3",   name: "Vendas cartões de crédito", type: "INCOME", category_group: "REVENUE" },
  { code: "3.1.4",   name: "Vendas em cheque",        type: "INCOME", category_group: "REVENUE" },
  { code: "3.1.5",   name: "Vendas em boleto",        type: "INCOME", category_group: "REVENUE" },
  { code: "3.1.99",  name: "Outros produtos/serviços", type: "INCOME", category_group: "REVENUE" },
  { code: "3.2",     name: "Outras receitas de vendas", type: "INCOME", category_group: "REVENUE" },
  { code: "3.2.99",  name: "Outras receitas de vendas", type: "INCOME", category_group: "REVENUE" },
  { code: "3.3",     name: "Recebimento de juros",    type: "INCOME", category_group: "REVENUE" },

  // 4 — Custos Variáveis
  { code: "4",       name: "Custos Variáveis",        type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.1",     name: "Custos tributários ou financeiros", type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.1.1",   name: "Simples nacional",        type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.1.2",   name: "Taxas de cartões",        type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.1.3",   name: "Taxas de boleto",         type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.1.99",  name: "Outros custos financeiros", type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.2",     name: "Custos com fornecedores", type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.2.1",   name: "Fornecedores",            type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.2.2",   name: "Frete (compras)",         type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.2.99",  name: "Outros custos com fornecedores", type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.3",     name: "Custos com embalagens",   type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.3.1",   name: "Custos com embalagens",   type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.3.99",  name: "Outros custos com embalagens", type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.4",     name: "Custo com vendas",        type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.4.1",   name: "Comissão interna",        type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.4.2",   name: "Frete (vendas)",          type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.4.99",  name: "Outros custos com vendas", type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },
  { code: "4.6",     name: "Outros custos variáveis", type: "EXPENSE", category_group: "VARIABLE_COST", cost_behavior: "VARIABLE" },

  // 5 — Despesas Fixas
  { code: "5",       name: "Despesas Fixas",          type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.1",     name: "Despesas financeiras",    type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.1.1",   name: "Tarifas bancárias",       type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.1.2",   name: "Aluguel de máquinas de cartão", type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.1.3",   name: "Tarifas DOC/TED",         type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.1.9",   name: "Outros custos com despesas financeiras", type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.2",     name: "Despesas administrativas", type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.3",     name: "Despesas com pessoal",    type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.4",     name: "Despesas com materiais e equipamentos", type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.5",     name: "Despesas com veículos",   type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },
  { code: "5.8",     name: "Outros tipos de despesas", type: "EXPENSE", category_group: "FIXED_EXPENSE", cost_behavior: "FIXED" },

  // 6 — Investimentos
  { code: "6",       name: "Investimentos",           type: "EXPENSE", category_group: "INVESTMENT" },

  // 7 — Movimentações Não Operacionais
  { code: "7",       name: "Movimentações Não Operacionais", type: "EXPENSE", category_group: "NON_OPERATIONAL" },

  // 13 — Acerto de Caixa
  { code: "13",      name: "Acerto de Caixa",         type: "EXPENSE", category_group: "CASH_ADJUSTMENT" },
];

export function levelFromCode(code: string): number {
  return code.split(".").length;
}

export function parentCode(code: string): string | null {
  const parts = code.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

export function sortOrderFromCode(code: string): number {
  // Numerical sort weight preserving hierarchy (e.g. 3.1.1 < 3.1.2 < 3.1.99 < 3.2).
  const parts = code.split(".").map((p) => parseInt(p, 10) || 0);
  while (parts.length < 4) parts.push(0);
  return parts[0] * 1_000_000_000 + parts[1] * 1_000_000 + parts[2] * 1_000 + parts[3];
}
