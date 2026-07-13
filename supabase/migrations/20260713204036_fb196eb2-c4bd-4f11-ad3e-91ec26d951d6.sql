-- P0-05: fix duplicidade financeira por origem

-- 1) Remove índice equivocado que bloqueia múltiplas despesas na mesma OS
DROP INDEX IF EXISTS public.financial_transactions_unique_so_expense;

-- 2) Backfill: preenche origin_type/origin_id para QUOTE_PAYMENT existentes
UPDATE public.financial_transactions
SET origin_type = 'QUOTE_PAYMENT',
    origin_id = quote_payment_id
WHERE quote_payment_id IS NOT NULL
  AND origin_id IS NULL
  AND deleted_at IS NULL;

-- 3) Índice único defensivo por (company_id, quote_payment_id)
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_quote_payment
ON public.financial_transactions (company_id, quote_payment_id)
WHERE quote_payment_id IS NOT NULL AND deleted_at IS NULL;
