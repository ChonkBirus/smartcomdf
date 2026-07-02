
ALTER TABLE public.crm_opportunities ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS crm_opportunities_stage_sort_idx ON public.crm_opportunities(stage_id, sort_order);

-- Backfill sort_order per stage using created_at desc
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY stage_id ORDER BY created_at DESC) * 100 AS pos
  FROM public.crm_opportunities WHERE deleted_at IS NULL
)
UPDATE public.crm_opportunities o SET sort_order = r.pos FROM ranked r WHERE r.id = o.id AND o.sort_order = 0;
