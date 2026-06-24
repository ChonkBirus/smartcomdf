
-- Admin RPCs for subscription management (Etapa D)

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(
  _status text DEFAULT NULL,
  _search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  company_name text,
  plan_id uuid,
  plan_name text,
  plan_slug text,
  status text,
  billing_cycle text,
  monthly_price numeric,
  yearly_price numeric,
  trial_ends_at timestamptz,
  grace_period_ends_at timestamptz,
  current_period_end date,
  next_billing_date date,
  canceled_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.company_id, c.corporate_name AS company_name,
         s.plan_id, p.name AS plan_name, p.slug AS plan_slug,
         s.status, s.billing_cycle, s.monthly_price, s.yearly_price,
         s.trial_ends_at, s.grace_period_ends_at, s.current_period_end,
         s.next_billing_date, s.canceled_at, s.created_at
  FROM public.subscriptions s
  LEFT JOIN public.companies c ON c.id = s.company_id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE public.has_role(auth.uid(), 'super_admin')
    AND (_status IS NULL OR s.status = _status)
    AND (_search IS NULL OR _search = '' OR c.corporate_name ILIKE '%' || _search || '%')
  ORDER BY s.created_at DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.admin_list_subscriptions(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  _subscription_id uuid,
  _new_plan_id uuid DEFAULT NULL,
  _new_status text DEFAULT NULL,
  _new_billing_cycle text DEFAULT NULL,
  _extend_trial_days int DEFAULT NULL,
  _extend_grace_days int DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.subscriptions;
  v_prev_status text;
  v_prev_plan uuid;
BEGIN
  IF NOT public.has_role(v_uid, 'super_admin') THEN
    RAISE EXCEPTION 'Acesso restrito a Super Admins.';
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = _subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada.'; END IF;

  v_prev_status := v_sub.status;
  v_prev_plan := v_sub.plan_id;

  UPDATE public.subscriptions SET
    plan_id = COALESCE(_new_plan_id, plan_id),
    status = COALESCE(_new_status, status),
    billing_cycle = COALESCE(_new_billing_cycle, billing_cycle),
    trial_ends_at = CASE WHEN _extend_trial_days IS NOT NULL
                         THEN COALESCE(trial_ends_at, now()) + (_extend_trial_days || ' days')::interval
                         ELSE trial_ends_at END,
    grace_period_ends_at = CASE WHEN _extend_grace_days IS NOT NULL
                                THEN COALESCE(grace_period_ends_at, now()) + (_extend_grace_days || ' days')::interval
                                ELSE grace_period_ends_at END,
    canceled_at = CASE WHEN _new_status = 'CANCELED' AND canceled_at IS NULL THEN now() ELSE canceled_at END,
    suspended_at = CASE WHEN _new_status = 'SUSPENDED' AND suspended_at IS NULL THEN now() ELSE suspended_at END,
    activated_at = CASE WHEN _new_status = 'ACTIVE' AND activated_at IS NULL THEN now() ELSE activated_at END,
    active = CASE WHEN _new_status IN ('ACTIVE','TRIALING') THEN true
                  WHEN _new_status IN ('SUSPENDED','CANCELED','EXPIRED') THEN false
                  ELSE active END,
    updated_at = now()
  WHERE id = _subscription_id;

  INSERT INTO public.subscription_events (
    company_id, subscription_id, event_type, previous_status, new_status,
    previous_plan_id, new_plan_id, description, metadata, created_by
  ) VALUES (
    v_sub.company_id, v_sub.id, 'MANUAL_ADJUSTMENT',
    v_prev_status, COALESCE(_new_status, v_prev_status),
    v_prev_plan, COALESCE(_new_plan_id, v_prev_plan),
    COALESCE(_description, 'Ajuste manual via SaaS Admin'),
    jsonb_build_object(
      'extend_trial_days', _extend_trial_days,
      'extend_grace_days', _extend_grace_days,
      'new_billing_cycle', _new_billing_cycle
    ),
    v_uid
  );

  RETURN _subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_subscription(uuid, uuid, text, text, int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription(uuid, uuid, text, text, int, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_subscription_events(_subscription_id uuid)
RETURNS SETOF public.subscription_events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.* FROM public.subscription_events e
  WHERE public.has_role(auth.uid(), 'super_admin')
    AND e.subscription_id = _subscription_id
  ORDER BY e.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.admin_list_subscription_events(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscription_events(uuid) TO authenticated;
