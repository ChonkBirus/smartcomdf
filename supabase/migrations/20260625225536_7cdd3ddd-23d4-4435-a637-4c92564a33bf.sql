-- C1-B: Upgrade / Downgrade scheduling for subscriptions

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_plan_billing_cycle text,
  ADD COLUMN IF NOT EXISTS pending_plan_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_plan_change_type text,
  ADD COLUMN IF NOT EXISTS pending_plan_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_plan_requested_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pending_plan_change_type_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_pending_plan_change_type_check
      CHECK (pending_plan_change_type IS NULL OR pending_plan_change_type IN ('UPGRADE','DOWNGRADE'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pending_plan_cycle_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_pending_plan_cycle_check
      CHECK (pending_plan_billing_cycle IS NULL OR pending_plan_billing_cycle IN ('MONTHLY','YEARLY'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_change_at
  ON public.subscriptions(pending_plan_change_at)
  WHERE pending_plan_change_at IS NOT NULL;

-- Cron-friendly processor: applies scheduled downgrades whose effective date has passed.
-- Returns the number of subscriptions updated.
CREATE OR REPLACE FUNCTION public.process_pending_plan_changes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  cnt integer := 0;
  v_monthly numeric;
  v_yearly  numeric;
BEGIN
  FOR r IN
    SELECT s.id, s.company_id, s.plan_id AS old_plan_id, s.pending_plan_id,
           s.pending_plan_billing_cycle, s.pending_plan_change_type
    FROM public.subscriptions s
    WHERE s.pending_plan_change_at IS NOT NULL
      AND s.pending_plan_change_at <= now()
      AND s.pending_plan_id IS NOT NULL
      AND s.pending_plan_change_type = 'DOWNGRADE'
  LOOP
    SELECT monthly_price, annual_price INTO v_monthly, v_yearly
      FROM public.plans WHERE id = r.pending_plan_id;

    UPDATE public.subscriptions
       SET plan_id = r.pending_plan_id,
           billing_cycle = COALESCE(r.pending_plan_billing_cycle, billing_cycle),
           monthly_price = COALESCE(v_monthly, monthly_price),
           yearly_price  = COALESCE(v_yearly, yearly_price),
           pending_plan_id = NULL,
           pending_plan_billing_cycle = NULL,
           pending_plan_change_at = NULL,
           pending_plan_change_type = NULL,
           pending_plan_requested_at = NULL,
           pending_plan_requested_by = NULL
     WHERE id = r.id;

    INSERT INTO public.subscription_events
      (subscription_id, company_id, event_type, from_status, to_status, old_plan_id, new_plan_id, metadata)
    VALUES
      (r.id, r.company_id, 'DOWNGRADE_APPLIED', NULL, NULL, r.old_plan_id, r.pending_plan_id,
       jsonb_build_object('billing_cycle', r.pending_plan_billing_cycle));

    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$;

REVOKE ALL ON FUNCTION public.process_pending_plan_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_pending_plan_changes() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_pending_plan_changes() TO service_role;
