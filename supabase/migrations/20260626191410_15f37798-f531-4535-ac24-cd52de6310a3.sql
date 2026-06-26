ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS diagnosis_problem text,
  ADD COLUMN IF NOT EXISTS diagnosis_need text,
  ADD COLUMN IF NOT EXISTS diagnosis_environment text,
  ADD COLUMN IF NOT EXISTS diagnosis_objective text,
  ADD COLUMN IF NOT EXISTS diagnosis_critical_points text,
  ADD COLUMN IF NOT EXISTS diagnosis_technical_notes text;

-- Backfill valid_until for existing quotes that have NULL with issue_date + 15 days
UPDATE public.quotes
SET valid_until = (issue_date + INTERVAL '15 days')::date
WHERE valid_until IS NULL;