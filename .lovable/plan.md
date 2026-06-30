## FASE 2.16B — Integração Financeira com ERP

Não há erro reportado; o texto é uma especificação. Antes de implementar, confirme o plano abaixo.

### Escopo desta fase
1. **Banco (migração única)**
   - Adicionar índice único parcial em `financial_transactions` para impedir duplicidade:
     - `(company_id, quote_id, type, origin)` quando `quote_id is not null and deleted_at is null`
     - `(company_id, purchase_id, type, origin)` quando `purchase_id is not null and deleted_at is null`
   - Adicionar permissões: `finance.receivables.manage`, `finance.payables.manage`, `finance.view_costs` e vincular a `owner`/`financial`.

2. **Server functions** — `src/lib/finance-integrations.functions.ts`
   - `createReceivableFromQuote({ quote_id, due_date? })`
   - `getReceivableByQuote({ quote_id })`
   - `markReceivablePaidFromQuote({ quote_id, paid_at?, payment_method? })`
   - `createPayableFromPurchase({ purchase_id, due_date? })` (se tabela existir)
   - `getCustomerFinancialSummary({ customer_id })`
   - `getProjectFinancialSummary({ project_id })`
   - `getServiceOrderFinancialSummary({ service_order_id })`
   - Todas com `requireSupabaseAuth`, scope por `company_id`, checagem de duplicidade antes do insert, retorno idempotente.

3. **Gancho de pagamento**
   - No fluxo `accept_public_quote` / confirmação de `quote_payments`: chamar `markReceivablePaidFromQuote` ou criar `financial_transaction` PAID se ainda não existir. Sem reescrever o modelo de parcelas.

4. **UI**
   - `QuoteFinancialActions` no detalhe do orçamento aprovado: "Gerar conta a receber" / "Ver conta a receber" + `FinancialLinkedBadge`.
   - `CustomerFinancialSummary` no `clients_.$id.tsx`: aba/seção Financeiro com KPIs (a receber, recebido, vencido) e tabela de lançamentos do cliente.
   - `ProjectFinancialSummary` no `projects_.$id.tsx`: card com orçamento origem, valor aprovado, recebido, pendente.
   - `ServiceOrderFinancialSummary` no `service-orders_.$id.tsx` (somente roles não-técnico): status financeiro sem custos.
   - `PurchaseFinancialActions` + `PayableFromPurchaseModal` apenas se o módulo de compras estiver ativo.

5. **Permissões**
   - Guardas em todas as ações novas; técnicos sem acesso a financeiro/custos.

6. **Testes manuais documentados** (multi-empresa, duplicidade, pagamento).

### Fora de escopo (explícito)
Open Finance, IA, precificação automática, billing SaaS/Asaas/webhook de assinatura, PDF premium, dashboard, DNS, auth, RLS global, parcelamento complexo.

### Riscos / decisões a confirmar
- **A**: Geração automática da conta a receber ao aprovar orçamento, **ou** **B**: somente botão manual com confirmação? Spec sugere B como padrão seguro — vou seguir B salvo indicação contrária.
- Para `due_date` padrão da conta a receber: usar `quote.valid_until` se existir, senão hoje + 7 dias.
- Compras: se `purchases`/`purchase_orders` existir, habilito o botão; senão, deixo função pronta mas sem UI.

Confirme (ou ajuste A/B) que eu executo numa única rodada: migração → server fns → UI → smoke test.
