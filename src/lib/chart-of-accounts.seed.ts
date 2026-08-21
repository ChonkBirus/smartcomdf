// Default chart of accounts for Smart Pro (server-side only source of truth).
// Referenced by the ensureDefaultChartOfAccounts server function.
//
// Idempotency: `code` is the stable key per company. Re-running the seed only
// inserts codes that don't yet exist for the company. Never overwrites user
// edits. New codes added to this list will be picked up on the next seed run
// (auto-triggered on ChartOfAccountsPage mount).

import type { CategoryGroup, CostBehavior, FinTxType } from "@/lib/finance.functions";

export type ChartOfAccountsSeedNode = {
  code: string;
  name: string;
  type: FinTxType;
  category_group: CategoryGroup;
  cost_behavior?: CostBehavior;
};

// Helpers to keep the list compact and consistent.
const rev = (code: string, name: string): ChartOfAccountsSeedNode => ({
  code,
  name,
  type: "INCOME",
  category_group: "REVENUE",
});
const varc = (code: string, name: string): ChartOfAccountsSeedNode => ({
  code,
  name,
  type: "EXPENSE",
  category_group: "VARIABLE_COST",
  cost_behavior: "VARIABLE",
});
const fix = (code: string, name: string): ChartOfAccountsSeedNode => ({
  code,
  name,
  type: "EXPENSE",
  category_group: "FIXED_EXPENSE",
  cost_behavior: "FIXED",
});
const inv = (code: string, name: string): ChartOfAccountsSeedNode => ({
  code,
  name,
  type: "EXPENSE",
  category_group: "INVESTMENT",
});
const nop = (code: string, name: string): ChartOfAccountsSeedNode => ({
  code,
  name,
  type: "EXPENSE",
  category_group: "NON_OPERATIONAL",
});
const cash = (code: string, name: string): ChartOfAccountsSeedNode => ({
  code,
  name,
  type: "EXPENSE",
  category_group: "CASH_ADJUSTMENT",
});

/**
 * Ordered flat list of the standard chart of accounts.
 * Level and parent are derived from `code` at seed/read time.
 * Adding new nodes here is safe — the seed inserts only missing codes.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: readonly ChartOfAccountsSeedNode[] = [
  // ============================================================
  // 3 — Receita / Faturamento
  // ============================================================
  rev("3", "Receita / Faturamento"),

  rev("3.1", "Receita de vendas"),
  rev("3.1.1", "Vendas em dinheiro"),
  rev("3.1.2", "Vendas cartões de débito"),
  rev("3.1.3", "Vendas cartões de crédito"),
  rev("3.1.4", "Vendas em cheque"),
  rev("3.1.5", "Vendas em boleto"),
  rev("3.1.6", "Vendas via Pix"),
  rev("3.1.7", "Venda de equipamentos"),
  rev("3.1.8", "Venda de produtos e serviços"),
  rev("3.1.9", "Venda de materiais"),
  rev("3.1.10", "Instalação de CFTV"),
  rev("3.1.11", "Instalação de alarmes"),
  rev("3.1.12", "Instalação de controle de acesso"),
  rev("3.1.13", "Instalação de interfonia"),
  rev("3.1.14", "Instalação de redes estruturadas"),
  rev("3.1.15", "Instalação de portões/automatizadores"),
  rev("3.1.16", "Manutenção corretiva"),
  rev("3.1.17", "Manutenção preventiva"),
  rev("3.1.18", "Contratos mensais / recorrência"),
  rev("3.1.19", "Visita técnica cobrada"),
  rev("3.1.20", "Projetos técnicos"),
  rev("3.1.99", "Outros produtos/serviços"),

  rev("3.2", "Outras receitas de vendas"),
  rev("3.2.1", "Receita de garantia estendida"),
  rev("3.2.2", "Receita de suporte técnico"),
  rev("3.2.3", "Receita de treinamento"),
  rev("3.2.4", "Receita de consultoria"),
  rev("3.2.99", "Outras receitas de vendas"),

  rev("3.3", "Recebimento de juros"),
  rev("3.3.1", "Juros por atraso de cliente"),
  rev("3.3.2", "Multas recebidas"),
  rev("3.3.3", "Correções recebidas"),

  rev("3.4", "Receitas não operacionais"),
  rev("3.4.1", "Venda de equipamento usado"),
  rev("3.4.2", "Reembolso de cliente"),
  rev("3.4.3", "Reembolso de fornecedor"),
  rev("3.4.4", "Bonificações recebidas"),
  rev("3.4.99", "Outras receitas não operacionais"),

  // ============================================================
  // 4 — Custos Variáveis
  // ============================================================
  varc("4", "Custos Variáveis"),

  varc("4.1", "Custos tributários ou financeiros"),
  varc("4.1.1", "Simples Nacional"),
  varc("4.1.2", "Taxas de cartões"),
  varc("4.1.3", "Taxas de boleto"),
  varc("4.1.4", "Taxas Pix"),
  varc("4.1.5", "Taxas de antecipação"),
  varc("4.1.6", "Comissões de venda"),
  varc("4.1.7", "Impostos sobre venda"),
  varc("4.1.8", "Taxas de marketplace/plataforma"),
  varc("4.1.99", "Outros custos financeiros"),

  varc("4.2", "Custos com fornecedores"),
  varc("4.2.1", "Fornecedores"),
  varc("4.2.2", "Frete de compras"),
  varc("4.2.3", "Compra de câmeras"),
  varc("4.2.4", "Compra de alarmes"),
  varc("4.2.5", "Compra de sensores"),
  varc("4.2.6", "Compra de cabos"),
  varc("4.2.7", "Compra de conectores"),
  varc("4.2.8", "Compra de fontes"),
  varc("4.2.9", "Compra de DVR/NVR"),
  varc("4.2.10", "Compra de controle de acesso"),
  varc("4.2.11", "Compra de interfones"),
  varc("4.2.12", "Compra de fechaduras"),
  varc("4.2.13", "Compra de equipamentos de rede"),
  varc("4.2.14", "Compra de materiais para instalação"),
  varc("4.2.15", "Compra de ferramentas para projeto específico"),
  varc("4.2.99", "Outros custos com fornecedores"),

  varc("4.3", "Custos com embalagens"),
  varc("4.3.1", "Embalagens"),
  varc("4.3.2", "Sacolas, caixas e proteção"),
  varc("4.3.3", "Etiquetas"),
  varc("4.3.99", "Outros custos com embalagens"),

  varc("4.4", "Custo com vendas"),
  varc("4.4.1", "Comissão interna"),
  varc("4.4.2", "Comissão externa"),
  varc("4.4.3", "Frete de vendas"),
  varc("4.4.4", "Desconto concedido"),
  varc("4.4.5", "Bonificação para fechar venda"),
  varc("4.4.6", "Garantia de venda"),
  varc("4.4.7", "Reposição por garantia"),
  varc("4.4.99", "Outros custos com vendas"),

  varc("4.5", "Custos de deslocamento e atendimento"),
  varc("4.5.1", "Combustível por atendimento"),
  varc("4.5.2", "Uber / aplicativo de transporte"),
  varc("4.5.3", "Táxi"),
  varc("4.5.4", "Estacionamento"),
  varc("4.5.5", "Pedágio"),
  varc("4.5.6", "Transporte público"),
  varc("4.5.7", "Motoboy / entrega"),
  varc("4.5.8", "Deslocamento técnico"),
  varc("4.5.9", "Hospedagem em atendimento externo"),
  varc("4.5.10", "Alimentação em atendimento externo"),
  varc("4.5.11", "Água, lanche ou refeição de equipe em serviço"),
  varc("4.5.99", "Outros custos de deslocamento"),

  varc("4.6", "Custos com mão de obra variável"),
  varc("4.6.1", "Técnico terceirizado"),
  varc("4.6.2", "Ajudante terceirizado"),
  varc("4.6.3", "Diária de instalador"),
  varc("4.6.4", "Hora extra por projeto"),
  varc("4.6.5", "Serviço terceirizado de instalação"),
  varc("4.6.6", "Serviço terceirizado de manutenção"),
  varc("4.6.7", "Freela / diarista"),
  varc("4.6.99", "Outros custos de mão de obra variável"),

  varc("4.7", "Custos de garantia e retrabalho"),
  varc("4.7.1", "Troca de equipamento em garantia"),
  varc("4.7.2", "Retorno técnico sem cobrança"),
  varc("4.7.3", "Material usado em garantia"),
  varc("4.7.4", "Deslocamento de garantia"),
  varc("4.7.5", "Retrabalho de instalação"),
  varc("4.7.99", "Outros custos de garantia"),

  varc("4.8", "Custos operacionais variáveis"),
  varc("4.8.1", "Insumos de instalação"),
  varc("4.8.2", "EPI usado em atendimento"),
  varc("4.8.3", "Pequenas ferramentas consumíveis"),
  varc("4.8.4", "Fita, abraçadeira, parafuso e fixadores"),
  varc("4.8.5", "Materiais auxiliares"),
  varc("4.8.99", "Outros custos operacionais variáveis"),

  varc("4.99", "Outros custos variáveis"),

  // ============================================================
  // 5 — Despesas Fixas
  // ============================================================
  fix("5", "Despesas Fixas"),

  fix("5.1", "Despesas financeiras"),
  fix("5.1.1", "Tarifas bancárias"),
  fix("5.1.2", "Aluguel de máquinas de cartão"),
  fix("5.1.3", "Tarifas DOC/TED"),
  fix("5.1.4", "Manutenção de conta bancária"),
  fix("5.1.5", "Juros pagos"),
  fix("5.1.6", "Multas pagas"),
  fix("5.1.7", "Encargos financeiros"),
  fix("5.1.9", "Outros custos com despesas financeiras"),

  fix("5.2", "Despesas administrativas"),
  fix("5.2.1", "Contabilidade"),
  fix("5.2.2", "Aluguel"),
  fix("5.2.3", "Condomínio"),
  fix("5.2.4", "Energia elétrica"),
  fix("5.2.5", "Água"),
  fix("5.2.6", "Internet"),
  fix("5.2.7", "Telefone"),
  fix("5.2.8", "Sistemas e softwares"),
  fix("5.2.9", "Assinaturas digitais"),
  fix("5.2.10", "Certificado digital"),
  fix("5.2.11", "Material de escritório"),
  fix("5.2.12", "Correios"),
  fix("5.2.13", "Cartório"),
  fix("5.2.14", "Honorários profissionais"),
  fix("5.2.15", "Serviços administrativos"),
  fix("5.2.99", "Outras despesas administrativas"),

  fix("5.3", "Despesas com pessoal"),
  fix("5.3.1", "Salários"),
  fix("5.3.2", "Pró-labore"),
  fix("5.3.3", "Encargos trabalhistas"),
  fix("5.3.4", "Benefícios"),
  fix("5.3.5", "Vale transporte"),
  fix("5.3.6", "Vale alimentação"),
  fix("5.3.7", "Treinamentos"),
  fix("5.3.8", "Uniformes"),
  fix("5.3.9", "Exames admissionais/demissionais"),
  fix("5.3.10", "Recrutamento e seleção"),
  fix("5.3.99", "Outras despesas com pessoal"),

  fix("5.4", "Despesas com materiais e equipamentos"),
  fix("5.4.1", "Ferramentas permanentes"),
  fix("5.4.2", "Equipamentos de uso interno"),
  fix("5.4.3", "Computadores"),
  fix("5.4.4", "Impressoras"),
  fix("5.4.5", "Celulares corporativos"),
  fix("5.4.6", "Manutenção de equipamentos internos"),
  fix("5.4.7", "Reposição de ferramentas"),
  fix("5.4.99", "Outras despesas com materiais e equipamentos"),

  fix("5.5", "Despesas com veículos"),
  fix("5.5.1", "Combustível administrativo"),
  fix("5.5.2", "Manutenção de veículo"),
  fix("5.5.3", "Seguro de veículo"),
  fix("5.5.4", "IPVA"),
  fix("5.5.5", "Licenciamento"),
  fix("5.5.6", "Multas de trânsito"),
  fix("5.5.7", "Lavagem"),
  fix("5.5.8", "Estacionamento administrativo"),
  fix("5.5.9", "Rastreador veicular"),
  fix("5.5.10", "Aluguel de veículo"),
  fix("5.5.99", "Outras despesas com veículos"),

  fix("5.6", "Marketing e vendas fixas"),
  fix("5.6.1", "Tráfego pago"),
  fix("5.6.2", "Agência de marketing"),
  fix("5.6.3", "Designer"),
  fix("5.6.4", "Produção de vídeo"),
  fix("5.6.5", "Site e hospedagem"),
  fix("5.6.6", "Domínio"),
  fix("5.6.7", "CRM / ferramenta comercial"),
  fix("5.6.8", "Material gráfico"),
  fix("5.6.9", "Brindes"),
  fix("5.6.99", "Outras despesas de marketing"),

  fix("5.7", "Despesas jurídicas e contábeis"),
  fix("5.7.1", "Advogado"),
  fix("5.7.2", "Consultoria contábil"),
  fix("5.7.3", "Consultoria financeira"),
  fix("5.7.4", "Taxas legais"),
  fix("5.7.5", "Licenças e alvarás"),
  fix("5.7.99", "Outras despesas jurídicas"),

  fix("5.8", "Outros tipos de despesas"),
  fix("5.8.1", "Alimentação administrativa"),
  fix("5.8.2", "Café, água e copa"),
  fix("5.8.3", "Limpeza"),
  fix("5.8.4", "Segurança"),
  fix("5.8.5", "Manutenção predial"),
  fix("5.8.6", "Doações"),
  fix("5.8.7", "Despesas diversas"),
  fix("5.8.99", "Outras despesas fixas"),

  // ============================================================
  // 6 — Investimentos
  // ============================================================
  inv("6", "Investimentos"),

  inv("6.1", "Investimentos em estrutura"),
  inv("6.1.1", "Compra de veículo"),
  inv("6.1.2", "Reforma da empresa"),
  inv("6.1.3", "Móveis e estrutura"),
  inv("6.1.4", "Equipamentos permanentes"),
  inv("6.1.5", "Computadores e tecnologia"),
  inv("6.1.6", "Ferramentas de alto valor"),
  inv("6.1.99", "Outros investimentos em estrutura"),

  inv("6.2", "Investimentos em crescimento"),
  inv("6.2.1", "Marketing estratégico"),
  inv("6.2.2", "Desenvolvimento de sistema"),
  inv("6.2.3", "Treinamento avançado"),
  inv("6.2.4", "Expansão comercial"),
  inv("6.2.5", "Consultoria estratégica"),
  inv("6.2.99", "Outros investimentos em crescimento"),

  // ============================================================
  // 7 — Movimentações Não Operacionais
  // ============================================================
  nop("7", "Movimentações Não Operacionais"),

  nop("7.1", "Transferências entre contas"),
  nop("7.1.1", "Transferência entre bancos"),
  nop("7.1.2", "Transferência para carteira"),
  nop("7.1.3", "Transferência para caixa"),
  nop("7.1.4", "Transferência para conta pessoal"),
  nop("7.1.99", "Outras transferências"),

  nop("7.2", "Empréstimos e financiamentos"),
  nop("7.2.1", "Entrada de empréstimo"),
  nop("7.2.2", "Pagamento de empréstimo"),
  nop("7.2.3", "Juros de empréstimo"),
  nop("7.2.4", "Financiamento"),
  nop("7.2.99", "Outros empréstimos/financiamentos"),

  nop("7.3", "Aportes e retiradas"),
  nop("7.3.1", "Aporte dos sócios"),
  nop("7.3.2", "Retirada de sócios"),
  nop("7.3.3", "Distribuição de lucros"),
  nop("7.3.4", "Adiantamento para sócio"),
  nop("7.3.99", "Outros aportes/retiradas"),

  // ============================================================
  // 13 — Acerto de Caixa
  // ============================================================
  cash("13", "Acerto de Caixa"),

  cash("13.1", "Ajustes de caixa"),
  cash("13.1.1", "Sobra de caixa"),
  cash("13.1.2", "Falta de caixa"),
  cash("13.1.3", "Correção de lançamento"),
  cash("13.1.4", "Ajuste de saldo inicial"),
  cash("13.1.99", "Outros acertos de caixa"),
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
