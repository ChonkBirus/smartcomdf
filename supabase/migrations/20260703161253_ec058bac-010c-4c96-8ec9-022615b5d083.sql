-- Deduplicate existing rows before creating each unique index.
-- Strategy: keep the earliest active row per group; soft-delete the rest.

-- 1) EXPENSE per purchase order
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY company_id, purchase_id
    ORDER BY (status = 'PAID') DESC, created_at ASC, id ASC
  ) AS rn
  FROM public.financial_transactions
  WHERE type = 'EXPENSE' AND purchase_id IS NOT NULL AND deleted_at IS NULL
)
UPDATE public.financial_transactions ft SET deleted_at = now()
FROM ranked r WHERE ft.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_purchase_expense
ON public.financial_transactions (company_id, purchase_id)
WHERE type = 'EXPENSE' AND purchase_id IS NOT NULL AND deleted_at IS NULL;

-- 2) EXPENSE per service order
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY company_id, service_order_id
    ORDER BY (status = 'PAID') DESC, created_at ASC, id ASC
  ) AS rn
  FROM public.financial_transactions
  WHERE type = 'EXPENSE' AND service_order_id IS NOT NULL AND deleted_at IS NULL
)
UPDATE public.financial_transactions ft SET deleted_at = now()
FROM ranked r WHERE ft.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_so_expense
ON public.financial_transactions (company_id, service_order_id)
WHERE type = 'EXPENSE' AND service_order_id IS NOT NULL AND deleted_at IS NULL;

-- 3) INCOME per service order (avulsa vinculada a OS)
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY company_id, service_order_id
    ORDER BY (status = 'PAID') DESC, created_at ASC, id ASC
  ) AS rn
  FROM public.financial_transactions
  WHERE type = 'INCOME' AND service_order_id IS NOT NULL AND quote_id IS NULL AND deleted_at IS NULL
)
UPDATE public.financial_transactions ft SET deleted_at = now()
FROM ranked r WHERE ft.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_so_income
ON public.financial_transactions (company_id, service_order_id)
WHERE type = 'INCOME' AND service_order_id IS NOT NULL AND quote_id IS NULL AND deleted_at IS NULL;

-- 4) Reconciliação com Open Finance: mesma transação bancária não pode gerar 2 lançamentos
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY company_id, openfinance_transaction_id
    ORDER BY created_at ASC, id ASC
  ) AS rn
  FROM public.financial_transactions
  WHERE openfinance_transaction_id IS NOT NULL AND deleted_at IS NULL
)
UPDATE public.financial_transactions ft SET deleted_at = now()
FROM ranked r WHERE ft.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_unique_openfinance
ON public.financial_transactions (company_id, openfinance_transaction_id)
WHERE openfinance_transaction_id IS NOT NULL AND deleted_at IS NULL;