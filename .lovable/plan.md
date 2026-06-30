
# FASE 2.16E — Open Finance e Conciliação Bancária

Escopo: criar a base provider-agnostic de Open Finance no SmartCom Pro (preparada para Pluggy/Belvo), importação de contas e transações, conciliação bancária com sugestão automática, revogação de consentimento e webhook seguro. Sem dados fictícios, sem senha bancária, sem service_role no frontend.

## 1. Banco de dados (1 migration)

Tabelas novas, todas com RLS + GRANTs:

- `openfinance_connections` — conexões com provider (status: PENDING/CONNECTED/SYNCING/ERROR/EXPIRED/REVOKED), consent_id, expires_at, last_sync_at.
- `financial_bank_accounts` — contas bancárias importadas (banco, tipo, agência, conta mascarada, saldo, consentimento, ativo).
- `openfinance_transactions` — transações importadas (CREDIT/DEBIT, raw_payload, reconciliation_status: PENDING/SUGGESTED/RECONCILED/IGNORED). UNIQUE (provider, provider_transaction_id, company_id) para idempotência.
- `bank_reconciliations` — vínculo entre transação bancária e `financial_transactions` (SUGGESTED/CONFIRMED/IGNORED/CANCELED, confidence_score, matched_by SYSTEM/MANUAL).
- `openfinance_webhook_events` — log idempotente de eventos do provider (UNIQUE provider+event_id).

Alterações em `financial_transactions`:
- adicionar coluna `openfinance_transaction_id uuid NULL` (origem da conciliação) — sem FK rígida para evitar acoplamento; valor referencia `openfinance_transactions.id`.
- adicionar coluna `origin text NULL` (ex: 'MANUAL', 'OPEN_FINANCE', 'QUOTE', ...) se ainda não existir.

RLS:
- SELECT/INSERT/UPDATE: `is_company_member(auth.uid(), company_id)` + checagem de permissão via `has_permission`/`has_role` quando aplicável.
- DELETE: bloqueado para usuário comum; preferir soft-delete (`revoked_at`, `active=false`, status IGNORED/CANCELED).
- service_role: ALL (para server functions privilegiadas + webhook).

Permissões novas (inseridas em `permissions`):
`finance.openfinance.view|connect|manage|revoke`, `finance.reconciliation.view|manage`, `finance.bank_accounts.view|manage`.
Atribuir ao role `owner` e `financial` por padrão (via `role_permissions`).

## 2. Server layer

Arquivos novos:

- `src/lib/open-finance/provider.ts` — abstração `OpenFinanceProvider` (interface) + factory `getProvider()` que lê `process.env.OPEN_FINANCE_PROVIDER` e retorna implementação. Stubs `PluggyProvider`, `BelvoProvider`, `NullProvider`. Sem chamadas reais ainda; `NullProvider` é usado quando secrets ausentes e retorna `{ configured: false }`.
- `src/lib/open-finance.server.ts` — helpers server-only (load provider, secrets, audit log).
- `src/lib/open-finance.functions.ts` — server functions:
  - `getOpenFinanceStatus`, `listOpenFinanceConnections`, `createOpenFinanceConnection`, `syncOpenFinanceAccounts`, `syncOpenFinanceTransactions`, `listBankAccounts`, `listOpenFinanceTransactions`, `revokeOpenFinanceConnection`.
- `src/lib/reconciliation.functions.ts` — server functions:
  - `suggestBankReconciliation`, `listReconciliationSuggestions`, `confirmReconciliation`, `ignoreBankTransaction`, `createFinancialTransactionFromBankTransaction`, `undoReconciliation`.
- `src/routes/api/public/open-finance.webhook.ts` — server route POST. Valida assinatura HMAC com `*_WEBHOOK_SECRET`, grava em `openfinance_webhook_events` (idempotente por event_id), despacha para provider handler. Carrega `supabaseAdmin` dentro do handler.

Regras comuns: `requireSupabaseAuth`, validar `company_id` via `is_company_member`, checar permissão via `has_permission`, nunca expor tokens/secrets ao cliente, status `{ configured: boolean, provider: string|null, reason?: string }` quando provider ausente.

Algoritmo `suggestBankReconciliation` (confidence 0–100):
- valor igual: +40 (tolerância R$ 0,01); diferença ≤ 1%: +25.
- data ±2 dias: +20.
- descrição semelhante (similaridade textual normalizada > 0.6): +20.
- cliente/fornecedor compatível: +10.
- status pendente/PAID compatível: +10.
Threshold: ≥75 alta, 50–74 média, <50 não sugerir.

## 3. Frontend (rota `/finance`)

Adicionar duas tabs na página existente `/finance`:
- **Open Finance** (`OpenFinancePage`)
- **Conciliação Bancária** (`BankReconciliationPage`)

Componentes em `src/components/finance/open-finance/`:
`OpenFinancePage`, `OpenFinanceConnectPanel`, `OpenFinanceConnectionsList`, `BankAccountsList`, `BankTransactionsTable`, `RevokeConsentModal`, `OpenFinanceStatusBadge`, `OpenFinanceEmptyState`.

Em `src/components/finance/reconciliation/`:
`BankReconciliationPage`, `ReconciliationSuggestionsTable`, `ReconciliationActionModal`, `CreateTransactionFromBankModal`.

Gates:
- `SubscriptionGuard` exigindo plano Business.
- `PermissionGuard` por permissão.
- Técnico → bloqueado.

Empty / status:
- Sem provider: card "Open Finance ainda não configurado" + orientação técnica só para super_admin.
- Sem conexão: "Nenhuma conta empresarial conectada."
- Sem transação: "Nenhuma movimentação bancária importada."
- Sem pendência: "Nenhuma transação pendente de conciliação."

## 4. Secrets (não criar nesta fase)

Documentar no painel (super_admin): `OPEN_FINANCE_PROVIDER`, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET` (ou equivalentes Belvo). Solicitados via `add_secret` somente quando o usuário escolher o provider — fora do escopo desta entrega.

## 5. Detalhes técnicos

- `confirmReconciliation`: transação SQL — insere `bank_reconciliations`, atualiza `openfinance_transactions.reconciliation_status='RECONCILED'`, vincula `reconciled_transaction_id`, atualiza `financial_transactions.status='RECONCILED'` (+ `paid_at` se NULL). Auditado.
- `createFinancialTransactionFromBankTransaction`: cria `financial_transactions` com `origin='OPEN_FINANCE'`, `openfinance_transaction_id`, depois chama `confirmReconciliation`.
- `ignoreBankTransaction`: `reconciliation_status='IGNORED'`, motivo opcional.
- `undoReconciliation`: reverte status e nulifica vínculo (auditado).
- Webhook: idempotência por `(provider, event_id)`; resposta 200 sempre que processado/duplicado; 401 se assinatura inválida.

## 6. Testes

Implementar testes unitários para o scorer de sugestão (`scoreMatch.test.ts`) cobrindo: valor exato, ±2 dias, descrição similar, mismatch de tipo, threshold.

Testes manuais documentados no entregável (sem provider, permissão, multiempresa, ignorar, revogar).

## 7. NÃO ALTERAR

Asaas billing SaaS, webhook de assinatura, dashboard, PDF, orçamentos, OS, estoque, auth, domínio, site institucional.

## Entrega final

Resumo com tabelas/policies/componentes/funções criados, qual provider está preparado (todos via abstração, ativo = NullProvider até secrets), lista de secrets pendentes, e roteiros de teste.

---

Posso prosseguir com a implementação?
