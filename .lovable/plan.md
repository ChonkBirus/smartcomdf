# FASE 2.12 — Módulo de Relatórios Gerenciais

Escopo grande. Proponho dividir em 3 sub-etapas entregáveis e revisáveis, para reduzir risco de regressão (padrão já adotado em 2.7B/2.7C). Cada etapa termina com build/typecheck verde e UI navegável.

---

## Etapa A — Fundação (rota, RBAC, filtros, Visão Geral)

**Backend**
- Migration: adicionar permissões `reports.view`, `reports.export`, `reports.financial`, `reports.operational`, `reports.stock`, `reports.sales`, `reports.technicians` na tabela `permissions` e vincular aos papéis (owner=todas; manager=view/operational/stock/sales/technicians; financial=view/financial/sales; technician=nenhuma).
- `src/lib/reports.functions.ts`:
  - `getReportsOverview(filters)` — agrega quotes/projects/service_orders/customers/items respeitando `company_id` via `requireSupabaseAuth` + RLS.
- Sem novas tabelas; só leitura agregada.

**Frontend**
- Rota `src/routes/_authenticated/reports.tsx` + sub-rotas por aba (ou single page com tabs — usar tabs para simplicidade).
- Item de menu "Relatórios" no `AppSidebar` (gated por `reports.view` + FeatureGate Pro/Business — Starter limitado).
- Componentes:
  - `ReportsPage`, `ReportsFilters` (período rápido + custom range + cliente/status), `ReportsMetricCard`, `ReportsTabs`, `ReportsOverview`, `ReportEmptyState`.
- Filtros via URL search params (TanStack Router) para deep-link.

## Etapa B — Relatórios operacionais e comerciais

- `getSalesReport`, `getQuotesReport`, `getProjectsReport`, `getServiceOrdersReport`, `getCustomersReport`, `getTechniciansReport`.
- Componentes de aba correspondentes + `ReportDataTable` reutilizável (paginação client-side com limite server-side de 500 linhas).
- Gráficos: usar `recharts` se já instalado; senão, só cards/tabelas (verificar antes).
- Regras: nunca expor custo/margem sem `reports.financial`.

## Etapa C — Estoque, Financeiro básico e Exportação

- `getStockReport` (saldos + status Normal/Baixo/Sem), `getFinancialBasicReport` (gated por `reports.financial`).
- `exportReportCsv(reportType, filters)` server-fn — gera CSV server-side, retorna string; botão `ReportExportButton` (gated por `reports.export`).
- PDF: opcional — só se viável reusando infra de `quote-pdf`; senão, fica para etapa futura.

---

## Detalhes técnicos transversais

- **RLS**: tudo via `requireSupabaseAuth`; queries filtram por `company_id` derivado do `userId`. Nenhum uso de `supabaseAdmin`.
- **Performance**: cada server-fn aceita `{ from, to, limit, offset }`; limites duros (500 linhas tabelas, agregados via `count: 'exact', head: true` quando possível).
- **Cache**: React Query com `queryKey: ['reports', tab, filters]`, `staleTime: 60_000`.
- **UI**: `PageHeader`, `StatusBadge`, `EmptyState` globais já existentes. Tailwind tokens semânticos, dark/light ok, responsivo (tabs viram select em <640px).
- **FeatureGate**: Starter → só abas Visão Geral/Orçamentos/Clientes/Estoque-básico. Pro → +OS/Projetos/Técnicos/Comercial. Business → +Financeiro/Exportação completa.

## Não tocar
billing Asaas, webhooks, CNPJ, PDF premium, criação de orçamento, lógica de OS/projetos/estoque/clientes, RLS existente (só adiciona permissões), rotas existentes.

---

## Pergunta antes de começar

Confirma que sigo **Etapa A primeiro** (rota + menu + RBAC + filtros + Visão Geral funcional com dados reais), e ao validar visualmente eu continuo com B e C? Ou prefere que eu entregue A+B+C de uma vez (mais risco, menos turnos)?
