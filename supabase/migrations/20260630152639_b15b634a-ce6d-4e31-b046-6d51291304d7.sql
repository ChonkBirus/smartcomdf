
-- Decouple bank_reconciliations from openfinance_transactions so it can also
-- reference file-imported bank_statement_transactions (E3).
ALTER TABLE public.bank_reconciliations
  DROP CONSTRAINT IF EXISTS bank_reconciliations_bank_transaction_id_fkey;

ALTER TABLE public.bank_reconciliations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'STATEMENT_FILE';

ALTER TABLE public.bank_reconciliations
  DROP CONSTRAINT IF EXISTS bank_reconciliations_source_check;
ALTER TABLE public.bank_reconciliations
  ADD CONSTRAINT bank_reconciliations_source_check
  CHECK (source IN ('OPEN_FINANCE','STATEMENT_FILE'));

CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_bank_tx
  ON public.bank_reconciliations (bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_fin_tx
  ON public.bank_reconciliations (financial_transaction_id);

-- Track the link on the statement transaction itself for fast lookups.
ALTER TABLE public.bank_statement_transactions
  ADD COLUMN IF NOT EXISTS reconciled_financial_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statement_tx_status
  ON public.bank_statement_transactions (company_id, reconciliation_status, transaction_date DESC);
