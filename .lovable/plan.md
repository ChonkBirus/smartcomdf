
# Refatoração do módulo Financeiro — ETAPA 1

Reorganizar o menu Financeiro em submenu com 11 itens, transformar `/finance` no novo **Dashboard financeiro** (estilo Yampa, identidade Smart Pro), e criar as telas de **Movimentações**, **Contas a receber** e **Contas a pagar** reutilizando as tabelas já existentes. Sem novas migrations nesta etapa (peço aprovação quando forem necessárias nas próximas etapas).

## O que muda para o usuário

- Menu lateral "Financeiro" vira grupo expansível com: Dashboard, Movimentações, Contas a receber, Contas a pagar, Custos, Precificação, Comparativo, Planejamento, Turbinador, Relatórios, Configurações.
- `/finance` redireciona para `/finance/dashboard`.
- Novo Dashboard com cards: Pagamentos & recebimentos, Clareza financeira, Saldos por conta, Índice de saúde, Previsão de movimentações, Indicadores, Receitas vs Despesas.
- Vazio real (EmptyState "Adicionar movimentação") quando não houver dados — sem mock.
- Movimentações, Receber e Pagar são **views filtradas** da tela de movimentações atual (INCOME/EXPENSE + status), com CRUD já existente.
- Etapas 2–6 (Custos, Markup, Comparativo, Planejamento, Turbinador, Relatórios) entram como rotas com EmptyState "Em breve" nesta etapa — o pedido é grande e será entregue por etapas conforme combinado.

## Rotas criadas

```text
/finance                          → redirect p/ /finance/dashboard
/finance/dashboard                → novo Dashboard (extraído do FinancePage atual)
/finance/transactions             → Movimentações (aba atual)
/finance/receivables              → Contas a receber (INCOME + filtros)
/finance/payables                 → Contas a pagar (EXPENSE + filtros)
/finance/costs                    → placeholder "Em breve" (ETAPA 2)
/finance/pricing                  → já existe (settings) + nova landing placeholder
/finance/comparison               → placeholder (ETAPA 3)
/finance/planning                 → placeholder (ETAPA 4)
/finance/profit-booster           → placeholder (ETAPA 5)
/finance/reports                  → aponta para FinanceReportsPage atual
/finance/settings                 → configurações (categorias/contas — reusa código existente)
```

## Arquivos que serão criados/editados

**Novos**
- `src/routes/_authenticated/finance.dashboard.tsx`
- `src/routes/_authenticated/finance.transactions.tsx`
- `src/routes/_authenticated/finance.receivables.tsx`
- `src/routes/_authenticated/finance.payables.tsx`
- `src/routes/_authenticated/finance.costs.tsx` (placeholder)
- `src/routes/_authenticated/finance.comparison.tsx` (placeholder)
- `src/routes/_authenticated/finance.planning.tsx` (placeholder)
- `src/routes/_authenticated/finance.profit-booster.tsx` (placeholder)
- `src/routes/_authenticated/finance.reports.tsx`
- `src/routes/_authenticated/finance.settings.tsx`
- `src/components/finance/dashboard/FinanceDashboard.tsx` (novo, agrega os cards)
- `src/components/finance/dashboard/PaymentsReceiptsCard.tsx`
- `src/components/finance/dashboard/ClarityCard.tsx`
- `src/components/finance/dashboard/BalancesCard.tsx`
- `src/components/finance/dashboard/HealthIndexCard.tsx`
- `src/components/finance/dashboard/ForecastCard.tsx`
- `src/components/finance/dashboard/IndicatorsCard.tsx`
- `src/components/finance/dashboard/IncomeExpenseCompareCard.tsx`
- `src/components/finance/TransactionsTable.tsx` (extraído do FinancePage, reutilizado por 3 telas)

**Editados**
- `src/routes/_authenticated/finance.tsx` → redirect para `/finance/dashboard`
- `src/components/app/AppSidebar.tsx` → grupo Financeiro expansível com 11 itens (respeita permissões e `state === "collapsed"`)
- `src/components/finance/FinancePage.tsx` → decompor: extrair TransactionsTable e cards de saldo/indicadores para os arquivos acima; manter export legado para não quebrar imports

**Não mexe:** `finance.functions.ts`, tabelas, RLS, orçamentos, CRM, projetos, OS, estoque, produtos, site, DNS, Asaas.

## Detalhes técnicos

**Dashboard — fontes de dados (todas via server fns já existentes):**
- `getFinanceOverview(range)` → totais recebíveis/pagáveis, atrasados, saldo período.
- `listFinancialTransactions({ range, status })` → prev. de hoje, atrasados.
- `getCashFlow(range)` → série entradas/saídas/saldo p/ gráfico Receitas vs Despesas e Previsão.
- Saldos por conta: `financial_bank_accounts` via nova query em `finance.functions.ts` **só se necessário** — se ainda não existir listagem, adiciono uma função `listBankAccountsWithBalance` (só leitura, sem migration).
- **Índice de saúde**: componente puro TS a partir dos dados acima — pesos: saldo positivo (20), sem atrasos > 30d (20), margem contrib > 0 (15), custos fixos < 60% receita (15), fluxo 30d positivo (15), sem recebíveis > 30d (15). Mostra selo Segurança/Eficiência/Tendência.
- **Comparativo com o ramo**: nesta etapa mostra apenas metas configuradas pela empresa; se `financial_goals` não existe (não existe hoje), exibe EmptyState "Configure metas em Planejamento" — sem benchmark falso.
- Permissões: cards de custo/margem escondidos sem `finance.view_costs`. Rotas usam `PermissionRoute module="finance"`.

**Movimentações / Receber / Pagar**: mesma `TransactionsTable` com `initialFilters` (type=INCOME|EXPENSE, status). Todos os CRUDs já existem em `finance.functions.ts`.

**Sidebar**: usa `SidebarGroup` com `defaultOpen` quando rota atual começa com `/finance`. Ícones lucide, verde neon apenas em item ativo.

**Visual**: mantém tokens atuais (bg-card, border-border, text-success verde marca, text-destructive vermelho, text-warning amarelo). Sem laranja.

## Fora do escopo desta etapa (peço confirmação depois)

- Migrations: `financial_accounts`, `financial_goals`, `financial_planning`, `pricing_simulations_v2`, `profit_booster_simulations`, `financial_health_snapshots`, `financial_comparisons`.
- Integração "orçamento pago → conta a receber" com idempotência por `quote_id` (parte 14) — hoje já existe parcial em `quote-payments.functions.ts`; auditar e corrigir será uma tarefa focada na ETAPA 2.
- Turbinador, Comparativo, Planejamento funcionais → ETAPAS 3–5.
- Relatórios adicionais → ETAPA 6.

## Testes ao final da ETAPA 1

1. Sidebar mostra grupo Financeiro com 11 itens; ativo destaca corretamente.
2. `/finance` redireciona para `/finance/dashboard`.
3. Empresa sem dados: dashboard mostra EmptyStates + botão "Adicionar movimentação".
4. Criar entrada R$10.000 e saída R$4.000 → saldo/lucro refletem no dashboard.
5. Contas a receber lista somente INCOME; Pagar somente EXPENSE.
6. Técnico (sem `finance.view_costs`) não vê cards de custo/margem.
7. `bun run build` e typecheck passam.

Aprovando esta ETAPA 1, começo a implementar. As etapas seguintes virão com plano próprio antes de qualquer migration.
