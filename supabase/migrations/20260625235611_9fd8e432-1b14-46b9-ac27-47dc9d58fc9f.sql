
-- ============ process_billing_dunning_rules ============
CREATE OR REPLACE FUNCTION public.process_billing_dunning_rules()
RETURNS TABLE(rule_code text, inserted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  inserted INTEGER;
BEGIN
  FOR r IN
    SELECT * FROM public.billing_dunning_rules WHERE active = true ORDER BY sort_order
  LOOP
    inserted := 0;

    IF r.trigger_type = 'TRIAL_ENDING' THEN
      WITH ins AS (
        INSERT INTO public.billing_dunning_events
          (company_id, subscription_id, rule_id, event_code, status, due_date, scheduled_for, channel)
        SELECT s.company_id, s.id, r.id, r.code, 'PENDING',
               s.trial_ends_at::date, s.trial_ends_at, 'INTERNAL'
          FROM public.subscriptions s
         WHERE s.trial = true
           AND s.trial_ends_at IS NOT NULL
           AND s.trial_ends_at::date = (current_date + r.trigger_offset_days)
        ON CONFLICT DO NOTHING
        RETURNING 1
      ) SELECT count(*) INTO inserted FROM ins;

    ELSIF r.trigger_type = 'TRIAL_EXPIRED' THEN
      WITH ins AS (
        INSERT INTO public.billing_dunning_events
          (company_id, subscription_id, rule_id, event_code, status, due_date, scheduled_for, channel)
        SELECT s.company_id, s.id, r.id, r.code, 'PENDING',
               s.trial_ends_at::date, now(), 'INTERNAL'
          FROM public.subscriptions s
         WHERE s.trial = true
           AND s.trial_ends_at IS NOT NULL
           AND s.trial_ends_at < now()
           AND (current_date - s.trial_ends_at::date) = r.trigger_offset_days
        ON CONFLICT DO NOTHING
        RETURNING 1
      ) SELECT count(*) INTO inserted FROM ins;

    ELSIF r.trigger_type = 'PAYMENT_DUE' THEN
      WITH ins AS (
        INSERT INTO public.billing_dunning_events
          (company_id, subscription_id, billing_charge_id, rule_id, event_code, status, due_date, scheduled_for, channel)
        SELECT c.company_id, c.subscription_id, c.id, r.id, r.code, 'PENDING',
               c.due_date, now(), 'INTERNAL'
          FROM public.billing_charges c
         WHERE c.status = 'PENDING'
           AND c.due_date = (current_date + r.trigger_offset_days)
        ON CONFLICT DO NOTHING
        RETURNING 1
      ) SELECT count(*) INTO inserted FROM ins;

    ELSIF r.trigger_type = 'PAYMENT_OVERDUE' THEN
      WITH ins AS (
        INSERT INTO public.billing_dunning_events
          (company_id, subscription_id, billing_charge_id, rule_id, event_code, status, due_date, scheduled_for, channel)
        SELECT c.company_id, c.subscription_id, c.id, r.id, r.code, 'PENDING',
               c.due_date, now(), 'INTERNAL'
          FROM public.billing_charges c
         WHERE c.status IN ('PENDING','OVERDUE')
           AND (current_date - c.due_date) = r.trigger_offset_days
        ON CONFLICT DO NOTHING
        RETURNING 1
      ) SELECT count(*) INTO inserted FROM ins;

    ELSIF r.trigger_type = 'SUBSCRIPTION_SUSPENDED' THEN
      WITH ins AS (
        INSERT INTO public.billing_dunning_events
          (company_id, subscription_id, rule_id, event_code, status, due_date, scheduled_for, channel)
        SELECT s.company_id, s.id, r.id, r.code, 'PENDING',
               s.suspended_at::date, now(), 'INTERNAL'
          FROM public.subscriptions s
         WHERE s.status = 'suspended'
           AND s.suspended_at IS NOT NULL
           AND (current_date - s.suspended_at::date) = r.trigger_offset_days
        ON CONFLICT DO NOTHING
        RETURNING 1
      ) SELECT count(*) INTO inserted FROM ins;

    ELSIF r.trigger_type = 'CANCELLATION_DUE_SOON' THEN
      WITH ins AS (
        INSERT INTO public.billing_dunning_events
          (company_id, subscription_id, rule_id, event_code, status, due_date, scheduled_for, channel)
        SELECT s.company_id, s.id, r.id, r.code, 'PENDING',
               s.cancellation_effective_at::date, now(), 'INTERNAL'
          FROM public.subscriptions s
         WHERE s.cancel_at_period_end = true
           AND s.cancellation_effective_at IS NOT NULL
           AND s.cancellation_effective_at::date = (current_date + r.trigger_offset_days)
        ON CONFLICT DO NOTHING
        RETURNING 1
      ) SELECT count(*) INTO inserted FROM ins;

    ELSIF r.trigger_type = 'REACTIVATED' THEN
      WITH ins AS (
        INSERT INTO public.billing_dunning_events
          (company_id, subscription_id, rule_id, event_code, status, due_date, scheduled_for, channel)
        SELECT s.company_id, s.id, r.id, r.code, 'PENDING',
               s.activated_at::date, now(), 'INTERNAL'
          FROM public.subscriptions s
         WHERE s.status = 'active'
           AND s.activated_at IS NOT NULL
           AND (current_date - s.activated_at::date) = r.trigger_offset_days
        ON CONFLICT DO NOTHING
        RETURNING 1
      ) SELECT count(*) INTO inserted FROM ins;
    END IF;

    rule_code := r.code;
    inserted_count := inserted;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_billing_dunning_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_billing_dunning_rules() TO service_role;

-- ============ register_dunning_contact ============
-- Marks a dunning event as HANDLED and records a commercial_contact_logs entry.
CREATE OR REPLACE FUNCTION public.register_dunning_contact(
  _event_id UUID,
  _channel TEXT,
  _result TEXT,
  _message TEXT,
  _next_follow_up_at TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev RECORD;
  log_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito';
  END IF;

  SELECT * INTO ev FROM public.billing_dunning_events WHERE id = _event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;

  INSERT INTO public.commercial_contact_logs
    (company_id, subscription_id, contact_type, contact_channel, subject, message, result, contacted_by, next_follow_up_at)
  VALUES
    (ev.company_id, ev.subscription_id, 'OVERDUE_COLLECTION',
     COALESCE(_channel,'MANUAL'), ev.event_code, _message, _result, auth.uid(), _next_follow_up_at)
  RETURNING id INTO log_id;

  UPDATE public.billing_dunning_events
     SET status = 'HANDLED',
         handled_by = auth.uid(),
         handled_at = now(),
         channel = COALESCE(_channel, channel),
         notes = COALESCE(_result, notes),
         updated_at = now()
   WHERE id = _event_id;

  RETURN log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_dunning_contact(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_dunning_contact(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated;
