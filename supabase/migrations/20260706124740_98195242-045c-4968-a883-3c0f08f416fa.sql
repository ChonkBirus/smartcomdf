
ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS level smallint,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_behavior text,
  ADD COLUMN IF NOT EXISTS category_group text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_categories_cost_behavior_check'
  ) THEN
    ALTER TABLE public.financial_categories
      ADD CONSTRAINT financial_categories_cost_behavior_check
      CHECK (cost_behavior IS NULL OR cost_behavior IN ('FIXED','VARIABLE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_categories_category_group_check'
  ) THEN
    ALTER TABLE public.financial_categories
      ADD CONSTRAINT financial_categories_category_group_check
      CHECK (category_group IS NULL OR category_group IN (
        'REVENUE','VARIABLE_COST','FIXED_EXPENSE','INVESTMENT','NON_OPERATIONAL','CASH_ADJUSTMENT'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_categories_level_check'
  ) THEN
    ALTER TABLE public.financial_categories
      ADD CONSTRAINT financial_categories_level_check
      CHECK (level IS NULL OR level BETWEEN 1 AND 3);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS financial_categories_company_code_uidx
  ON public.financial_categories (company_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS financial_categories_company_parent_sort_idx
  ON public.financial_categories (company_id, parent_id, sort_order);
