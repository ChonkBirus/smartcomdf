ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS bank_account_id uuid NULL
    REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_tx_bank_account
  ON public.financial_transactions(bank_account_id)
  WHERE bank_account_id IS NOT NULL AND deleted_at IS NULL;