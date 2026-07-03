-- Deduplicate any pre-existing duplicates before creating the unique index.
-- Keep the earliest (created_at) row per (company_id, quote_id) for INCOME.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY company_id, quote_id
           ORDER BY (status = 'PAID') DESC, created_at ASC, id ASC
         ) AS rn
  FROM public.financial_transactions
  WHERE type = 'INCOME'
    AND quote_id IS NOT NULL
    AND deleted_at IS NULL
)
UPDATE public.financial_transactions ft
SET deleted_at = now()
FROM ranked r
WHERE ft.id = r.id AND r.rn > 1;

-- Partial unique index: one active INCOME per (company_id, quote_id).
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_quote_income
ON public.financial_transactions (company_id, quote_id)
WHERE type = 'INCOME' AND quote_id IS NOT NULL AND deleted_at IS NULL;