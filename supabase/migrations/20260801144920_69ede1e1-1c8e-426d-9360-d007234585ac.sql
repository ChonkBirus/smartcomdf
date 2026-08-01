-- ============================================================
-- VIS-DRIFT-02 — visits.status domain + transitions
-- ============================================================

-- 1) pre-flight: no row may sit outside the approved domain
DO $mig$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT status, ', ') INTO bad
    FROM public.visits
   WHERE status NOT IN ('DRAFT','SCHEDULED','CONFIRMED','ON_THE_WAY','CHECKED_IN',
                        'IN_PROGRESS','PAUSED','COMPLETED','CANCELLED','NO_SHOW');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'drift_guard: visits rows outside approved status domain: %', bad;
  END IF;

  -- audit the physical constraint currently in place
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='public.visits'::regclass AND contype='c'
       AND conname IN ('visits_status_check','visits_status_chk')
  ) THEN
    RAISE EXCEPTION 'drift_guard: no status CHECK constraint found on public.visits';
  END IF;
END $mig$;

-- 2) replace ONLY the status constraint
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_status_chk;
ALTER TABLE public.visits
  ADD CONSTRAINT visits_status_chk CHECK (status = ANY (ARRAY[
    'DRAFT','SCHEDULED','CONFIRMED','ON_THE_WAY','CHECKED_IN',
    'IN_PROGRESS','PAUSED','COMPLETED','CANCELLED','NO_SHOW'
  ]::text[]));

-- 3) visit_events must accept STARTED / PAUSED / RESUMED
ALTER TABLE public.visit_events DROP CONSTRAINT IF EXISTS visit_events_type_check;
ALTER TABLE public.visit_events
  ADD CONSTRAINT visit_events_type_check CHECK (event_type = ANY (ARRAY[
    'CREATED','SCHEDULED_UPDATED','ASSIGNED','UNASSIGNED','CONFIRMED','ON_THE_WAY',
    'CHECKED_IN','STARTED','PAUSED','RESUMED','CHECKED_OUT','COMPLETED','CANCELLED',
    'NO_SHOW','PHOTO_ADDED','PHOTO_UPDATED','PHOTO_REMOVED'
  ]::text[]));

-- 4) transition engine
CREATE OR REPLACE FUNCTION public.visit_execute_transition(_visit_id uuid, _target text, _payload jsonb DEFAULT '{}'::jsonb, _client_request_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_visit   public.visits;
  v_ev      public.visit_events;
  v_ok      boolean := false;
  v_now     timestamptz := now();
  v_event   text;
  v_allowed text[];
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- RESUMED is an event, never a status target
  IF _target = 'RESUMED' THEN RAISE EXCEPTION 'invalid_target_status'; END IF;
  IF _target NOT IN ('CONFIRMED','ON_THE_WAY','CHECKED_IN','IN_PROGRESS','PAUSED',
                     'COMPLETED','CANCELLED','NO_SHOW') THEN
    RAISE EXCEPTION 'invalid_transition_target';
  END IF;

  SELECT * INTO v_visit FROM public.visits
    WHERE id = _visit_id AND company_id = v_company AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;

  -- post-lock idempotency
  IF _client_request_id IS NOT NULL THEN
    v_allowed := CASE WHEN _target = 'IN_PROGRESS' THEN ARRAY['STARTED','RESUMED']
                      ELSE ARRAY[_target] END;
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF FOUND THEN
      IF v_ev.visit_id <> _visit_id OR NOT (v_ev.event_type = ANY (v_allowed)) THEN
        RAISE EXCEPTION 'idempotency_key_reused';
      END IF;
      RETURN;
    END IF;
  END IF;

  -- permissions + allowed source states
  IF _target = 'CONFIRMED' THEN
    IF NOT public.has_permission('visits.edit') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('DRAFT','SCHEDULED');
    v_event := 'CONFIRMED';

  ELSIF _target = 'ON_THE_WAY' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('SCHEDULED','CONFIRMED');
    v_event := 'ON_THE_WAY';

  ELSIF _target = 'CHECKED_IN' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('SCHEDULED','CONFIRMED','ON_THE_WAY');
    v_event := 'CHECKED_IN';

  ELSIF _target = 'IN_PROGRESS' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.service_order_id IS NOT NULL THEN RAISE EXCEPTION 'blocked_by_service_order'; END IF;
    v_ok := v_visit.status IN ('CHECKED_IN','PAUSED');
    v_event := CASE WHEN v_visit.status = 'PAUSED' THEN 'RESUMED' ELSE 'STARTED' END;

  ELSIF _target = 'PAUSED' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.service_order_id IS NOT NULL THEN RAISE EXCEPTION 'blocked_by_service_order'; END IF;
    v_ok := v_visit.status = 'IN_PROGRESS';
    v_event := 'PAUSED';

  ELSIF _target = 'COMPLETED' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.service_order_id IS NOT NULL THEN RAISE EXCEPTION 'blocked_by_service_order'; END IF;
    v_ok := v_visit.status = 'IN_PROGRESS';
    v_event := 'COMPLETED';

  ELSIF _target = 'CANCELLED' THEN
    IF NOT public.has_permission('visits.cancel') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status NOT IN ('COMPLETED','CANCELLED');
    v_event := 'CANCELLED';

  ELSIF _target = 'NO_SHOW' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('SCHEDULED','CONFIRMED','ON_THE_WAY');
    v_event := 'NO_SHOW';
  END IF;

  IF NOT v_ok THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.visits SET
    status = _target,
    checked_in_at = CASE WHEN _target = 'CHECKED_IN' THEN v_now ELSE checked_in_at END,
    cancelled_at  = CASE WHEN _target = 'CANCELLED'  THEN v_now ELSE cancelled_at END,
    cancelled_by  = CASE WHEN _target = 'CANCELLED'  THEN v_user ELSE cancelled_by END,
    cancellation_reason = CASE WHEN _target = 'CANCELLED' THEN NULLIF(_payload->>'reason','') ELSE cancellation_reason END,
    updated_by = v_user,
    updated_at = v_now
  WHERE id = _visit_id;

  BEGIN
    INSERT INTO public.visit_events(company_id, visit_id, event_type, actor_user_id, event_data, client_request_id)
      VALUES (v_company, _visit_id, v_event, v_user, COALESCE(_payload,'{}'::jsonb), _client_request_id);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF NOT FOUND OR v_ev.visit_id <> _visit_id OR v_ev.event_type <> v_event THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    RETURN;
  END;
END; $function$;

-- 5) final guards
DO $chk$
DECLARE d text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint
   WHERE conrelid='public.visits'::regclass AND conname='visits_status_chk';
  IF d IS NULL THEN RAISE EXCEPTION 'drift_guard: visits_status_chk missing'; END IF;
  IF d NOT LIKE '%IN_PROGRESS%' OR d NOT LIKE '%PAUSED%' THEN
    RAISE EXCEPTION 'drift_guard: visits_status_chk missing new states: %', d;
  END IF;
  IF d LIKE '%RESUMED%' THEN
    RAISE EXCEPTION 'drift_guard: visits_status_chk must not contain RESUMED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
     WHERE ns.nspname='public' AND p.proname='visit_execute_transition'
       AND pg_get_function_identity_arguments(p.oid)
           IN ('uuid, text, jsonb, uuid',
               '_visit_id uuid, _target text, _payload jsonb, _client_request_id uuid')
  ) THEN
    RAISE EXCEPTION 'drift_guard: visit_execute_transition signature mismatch';
  END IF;
END $chk$;