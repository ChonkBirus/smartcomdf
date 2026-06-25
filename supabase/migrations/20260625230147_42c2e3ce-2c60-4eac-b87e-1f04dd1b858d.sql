-- C1-C: Cancellation & Reactivation
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS canceled_by UUID;

-- Cron-friendly: apply scheduled cancellations whose effective date has passed
CREATE OR REPLACE FUNCTION public.process_pending_cancellations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH due AS (
    SELECT id, company_id
    FROM public.subscriptions
    WHERE cancel_at_period_end = true
      AND cancellation_effective_at IS NOT NULL
      AND cancellation_effective_at <= now()
      AND status IN ('ACTIVE','TRIALING','PAST_DUE')
  ),
  upd AS (
    UPDATE public.subscriptions s
       SET status = 'CANCELED',
           canceled_at = now(),
           active = false,
           cancel_at_period_end = false,
           updated_at = now()
      FROM due
     WHERE s.id = due.id
     RETURNING s.id, s.company_id, s.plan_id
  ),
  ev AS (
    INSERT INTO public.subscription_events (company_id, subscription_id, event_type, old_plan_id, new_plan_id, metadata)
    SELECT company_id, id, 'CANCELLATION_APPLIED', plan_id, plan_id, '{"source":"cron"}'::jsonb FROM upd
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_pending_cancellations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_pending_cancellations() TO service_role;