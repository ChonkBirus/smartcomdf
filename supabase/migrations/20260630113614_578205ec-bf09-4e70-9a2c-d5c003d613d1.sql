
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_quote_income
  ON public.financial_transactions (company_id, quote_id, type)
  WHERE quote_id IS NOT NULL AND type = 'INCOME' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_purchase_expense
  ON public.financial_transactions (company_id, purchase_id, type)
  WHERE purchase_id IS NOT NULL AND type = 'EXPENSE' AND deleted_at IS NULL;
