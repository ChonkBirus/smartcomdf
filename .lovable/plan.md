## FASE 2.16A — Módulo Financeiro (base)

Construir a base do módulo financeiro da empresa cliente (separado do billing SaaS). Sem Open Finance, IA ou precificação.

### 1. Banco de dados (migration única)

**Tabelas novas (schema `public`):**

- `financial_categories`
  - `id`, `company_id` (FK companies), `name`, `type` (`INCOME`|`EXPENSE`), `parent_id` (self FK, null), `active` (bool default true), `is_default` (bool default false), `created_at`, `updated_at`
  - UNIQUE (`company_id`, `name`, `type`)
- `financial_transactions`
  - `id`, `company_id`, `type` (`INCOME`|`EXPENSE`), `category_id` (FK null), `description`, `amount` numeric(14,2), `due_date` date null, `paid_at` timestamptz null, `status` (`PLANNED`|`PAID`|`OVERDUE`|`CANCELED`|`RECONCILED`), `customer_id`, `supplier_id`, `quote_id`, `project_id`, `service_order_id`, `purchase_id` (todos FK nullable), `payment_method` text, `origin` (`MANUAL`|`QUOTE`|`PAYMENT`|`PURCHASE`|`SERVICE_ORDER`|`OPEN_FINANCE`|`IMPORT`), `notes`, `created_by` (auth.users), `created_at`, `updated_at`, `deleted_at` null
  - Índices em (`company_id`,`type`,`status`), (`company_id`,`due_date`)

**GRANTs:** `SELECT, INSERT, UPDATE, DELETE` para `authenticated`; `ALL` para `service_role`. Sem `anon`.

**RLS:** habilitar; políticas usando função existente `is_company_member(company_id)`:
- SELECT: `is_company_member(company_id)` e (para transactions) `deleted_at IS NULL`
- INSERT: `is_company_member(company_id)` + `auth.uid() = created_by`
- UPDATE: `is_company_member(company_id)`
- DELETE: bloqueado em transactions (usar soft delete via UPDATE); permitido em categorias só se `is_default = false`

**Função SQL `seed_default_financial_categories(_company_id uuid)`** SECURITY DEFINER — popula categorias padrão (lista do prompt) se não existirem.

**Trigger `updated_at`** nas duas tabelas.

### 2. Server functions (`src/lib/finance.functions.ts`)

Todas com `requireSupabaseAuth`, derivando `company_id` do contexto via `profiles`:

- `getFinanceOverview({ from, to })` → `{ income, expense, balance, receivables, payables, overdueReceivables, overduePayables }`
- `listFinancialTransactions({ type?, status?, from?, to?, categoryId?, customerId?, supplierId? })`
- `createFinancialTransaction(data)` (origin = `MANUAL` nesta fase)
- `updateFinancialTransaction(id, data)`
- `softDeleteFinancialTransaction(id)` — UPDATE `deleted_at = now()`
- `markTransactionAsPaid(id, paidAt?)` — status `PAID`, `paid_at`
- `cancelFinancialTransaction(id)` — status `CANCELED`
- `getCashFlow({ from, to })`
- `getReceivables(filters)` / `getPayables(filters)` (tipo + status)
- `listFinancialCategories({ type? })`
- `createFinancialCategory`, `updateFinancialCategory`, `deactivateFinancialCategory`
- `ensureDefaultFinancialCategories()` — chama RPC

Status calculado: se `status = PLANNED` e `due_date < hoje`, retornar `OVERDUE` em projeções (cálculo na query).

### 3. Permissões

Estender catálogo de permissões com:
`finance.view`, `finance.manage`, `finance.cashflow.view`, `finance.income.manage`, `finance.expense.manage`, `finance.receivables.manage`, `finance.payables.manage`, `finance.categories.manage`, `finance.view_costs`.

Atribuir ao perfil `owner` e `financial` por padrão via migração de seed de role_permissions (sem quebrar perfis existentes).

### 4. Rota e menu

- Nova rota autenticada `src/routes/_authenticated/finance.tsx` envolta em `<PermissionRoute module="finance">`.
- Substituir/atualizar `src/routes/_authenticated/financial.tsx` para redirecionar a `/finance` (ou apenas adicionar a nova).
- Adicionar item "Financeiro" no `AppSidebar` apontando para `/finance` com ícone `Wallet`.

### 5. Componentes (`src/components/finance/`)

`FinancePage`, `FinanceTabs` (Visão Geral, Fluxo de Caixa, Entradas, Saídas, A Receber, A Pagar, Categorias), `FinanceOverview`, `FinanceMetricCard`, `CashFlowView` (tabela), `FinancialTransactionTable`, `FinancialTransactionForm` (Sheet com RHF+Zod), `IncomeList`, `ExpenseList`, `ReceivablesList`, `PayablesList`, `FinancialCategoriesManager`, `FinanceEmptyState`, `FinanceFilters` (presets de período + custom).

UX: linguagem simples, cards com hint curto, sem mocks; empty state padrão SmartCom.

### 6. Aceite

- `/finance` carrega para usuários com `finance.view`; bloqueio amigável para os demais.
- Criar/editar/marcar pago/cancelar entrada e saída via UI funcionam.
- Overview e Fluxo de Caixa usam dados reais (zero para empresa nova).
- Empresa A vê apenas seus lançamentos; Empresa B vê zero (RLS).
- Build/typecheck passam.

### Notas técnicas

- Não tocar em billing SaaS, Asaas, webhooks, dashboard, quotes, OS, PDF, estoque.
- `companyId` derivado server-side; nunca aceito do cliente.
- Tudo soft delete em `financial_transactions`.
- Categorias padrão chamadas em `ensureDefaultFinancialCategories` no primeiro acesso à página.

Posso seguir?
