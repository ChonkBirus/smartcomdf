-- Garantir no banco que não haja duas reconciliações confirmadas para a mesma linha do extrato
CREATE UNIQUE INDEX IF NOT EXISTS bank_reconciliations_unique_confirmed_per_bank_tx
  ON public.bank_reconciliations (bank_transaction_id)
  WHERE status = 'CONFIRMED';