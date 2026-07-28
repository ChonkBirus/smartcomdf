-- =====================================================================
-- MIGRATION 3 — VISITAS TÉCNICAS: helpers e RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- HELPERS INTERNOS
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._visit_parse_ts(_raw text, _field text)
RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_out timestamptz;
BEGIN
  IF _raw IS NULL OR btrim(_raw) = '' THEN RETURN NULL; END IF;
  BEGIN
    v_out := _raw::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_%', _field USING ERRCODE = '22007';
  END;
  RETURN v_out;
END; $$;

CREATE OR REPLACE FUNCTION public._visit_distance_m(_visit_id uuid, _lat numeric, _lon numeric)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref_lat numeric;
  v_ref_lon numeric;
  v_r    constant numeric := 6371000;
  v_dlat numeric;
  v_dlon numeric;
  v_a    numeric;
BEGIN
  SELECT
    NULLIF(v.address_snapshot->>'latitude','')::numeric,
    NULLIF(v.address_snapshot->>'longitude','')::numeric
    INTO v_ref_lat, v_ref_lon
    FROM public.visits v
   WHERE v.id = _visit_id
     AND v.company_id = public.current_company_id()
     AND v.deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;
  IF v_ref_lat IS NULL OR v_ref_lon IS NULL OR _lat IS NULL OR _lon IS NULL THEN
    RETURN NULL;
  END IF;

  v_dlat := radians(_lat - v_ref_lat);
  v_dlon := radians(_lon - v_ref_lon);
  v_a := sin(v_dlat/2)^2 + cos(radians(v_ref_lat)) * cos(radians(_lat)) * sin(v_dlon/2)^2;
  v_a := GREATEST(0.0, LEAST(1.0, v_a));
  RETURN round((v_r * 2 * asin(sqrt(v_a)))::numeric, 2);
END; $$;

CREATE OR REPLACE FUNCTION public.next_visit_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO public.visit_number_counters (company_id, last_number)
    VALUES (_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = public.visit_number_counters.last_number + 1,
        updated_at  = now()
  RETURNING last_number INTO v_next;
  RETURN 'VIS-' || lpad(v_next::text, 6, '0');
END; $$;

-- ---------------------------------------------------------------------
-- CREATE_VISIT
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_visit(
  _payload jsonb,
  _client_request_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company      uuid := public.current_company_id();
  v_user         uuid := auth.uid();
  v_type         text := COALESCE(NULLIF(_payload->>'visit_type',''), 'DIAGNOSIS');
  v_customer     uuid := NULLIF(_payload->>'customer_id','')::uuid;
  v_address      uuid := NULLIF(_payload->>'customer_address_id','')::uuid;
  v_contact      uuid := NULLIF(_payload->>'customer_contact_id','')::uuid;
  v_responsible  uuid := NULLIF(_payload->>'responsible_user_id','')::uuid;
  v_tech         uuid := NULLIF(_payload->>'assigned_technician_id','')::uuid;
  v_title        text := btrim(_payload->>'title');
  v_desc         text := NULLIF(_payload->>'description','');
  v_pre_diag     text := NULLIF(_payload->>'pre_diagnosis','');
  v_rec_sol      text := NULLIF(_payload->>'recommended_solution','');
  v_internal     text := NULLIF(_payload->>'internal_notes','');
  v_start        timestamptz := public._visit_parse_ts(_payload->>'scheduled_start_at','scheduled_start_at');
  v_end          timestamptz := public._visit_parse_ts(_payload->>'scheduled_end_at','scheduled_end_at');
  v_addr_row     public.customer_addresses;
  v_addr_snap    jsonb;
  v_existing     public.visits;
  v_visit_id     uuid;
  v_number       text;
  v_zero         constant uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.create') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_type NOT IN ('DIAGNOSIS','INSPECTION','MAINTENANCE','PRE_SALE','OTHER') THEN
    RAISE EXCEPTION 'invalid_visit_type';
  END IF;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'customer_required'; END IF;
  IF v_title IS NULL OR length(v_title) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF v_start IS NULL OR v_end IS NULL THEN RAISE EXCEPTION 'schedule_required'; END IF;
  IF v_end <= v_start THEN RAISE EXCEPTION 'schedule_invalid_range'; END IF;

  IF v_responsible IS NULL THEN
    v_responsible := v_user;
  ELSE
    PERFORM 1 FROM public.profiles WHERE id = v_responsible AND company_id = v_company;
    IF NOT FOUND THEN RAISE EXCEPTION 'responsible_cross_company'; END IF;
  END IF;

  PERFORM 1 FROM public.customers WHERE id = v_customer AND company_id = v_company;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer_cross_company'; END IF;

  IF v_address IS NOT NULL THEN
    SELECT * INTO v_addr_row FROM public.customer_addresses
      WHERE id = v_address AND customer_id = v_customer;
    IF NOT FOUND THEN RAISE EXCEPTION 'address_cross_company'; END IF;
    v_addr_snap := jsonb_build_object(
      'address_type', v_addr_row.address_type,
      'zip_code',     v_addr_row.zip_code,
      'street',       v_addr_row.street,
      'number',       v_addr_row.number,
      'complement',   v_addr_row.complement,
      'district',     v_addr_row.district,
      'city',         v_addr_row.city,
      'state',        v_addr_row.state,
      'reference',    v_addr_row.reference,
      'latitude',     v_addr_row.latitude,
      'longitude',    v_addr_row.longitude
    );
  END IF;
  IF v_contact IS NOT NULL THEN
    PERFORM 1 FROM public.customer_contacts WHERE id = v_contact AND customer_id = v_customer;
    IF NOT FOUND THEN RAISE EXCEPTION 'contact_cross_company'; END IF;
  END IF;
  IF v_tech IS NOT NULL THEN
    PERFORM 1 FROM public.profiles WHERE id = v_tech AND company_id = v_company;
    IF NOT FOUND THEN RAISE EXCEPTION 'technician_cross_company'; END IF;
  END IF;

  IF _client_request_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_company::text || ':' || _client_request_id::text, 0)
    );
    SELECT * INTO v_existing FROM public.visits
      WHERE company_id = v_company AND client_request_id = _client_request_id
        AND deleted_at IS NULL;
    IF FOUND THEN
      IF v_existing.customer_id <> v_customer
         OR COALESCE(v_existing.customer_address_id, v_zero) <> COALESCE(v_address, v_zero)
         OR COALESCE(v_existing.customer_contact_id, v_zero) <> COALESCE(v_contact, v_zero)
         OR v_existing.responsible_user_id <> v_responsible
         OR COALESCE(v_existing.assigned_technician_id, v_zero) <> COALESCE(v_tech, v_zero)
         OR v_existing.scheduled_start_at <> v_start
         OR v_existing.scheduled_end_at   <> v_end
         OR v_existing.title              <> v_title
         OR v_existing.visit_type         <> v_type
      THEN
        RAISE EXCEPTION 'idempotency_key_reused';
      END IF;
      RETURN v_existing.id;
    END IF;
  END IF;

  v_number := public.next_visit_number(v_company);

  BEGIN
    INSERT INTO public.visits(
      company_id, visit_number, visit_type, status,
      customer_id, customer_address_id, customer_contact_id,
      responsible_user_id, assigned_technician_id,
      title, description, pre_diagnosis, recommended_solution, internal_notes,
      scheduled_start_at, scheduled_end_at,
      address_snapshot, created_by, client_request_id
    ) VALUES (
      v_company, v_number, v_type, 'SCHEDULED',
      v_customer, v_address, v_contact,
      v_responsible, v_tech,
      v_title, v_desc, v_pre_diag, v_rec_sol, v_internal,
      v_start, v_end,
      v_addr_snap, v_user, _client_request_id
    ) RETURNING id INTO v_visit_id;
  EXCEPTION WHEN unique_violation THEN
    IF _client_request_id IS NULL THEN RAISE; END IF;
    SELECT * INTO v_existing FROM public.visits
      WHERE company_id = v_company AND client_request_id = _client_request_id
        AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE; END IF;
    IF v_existing.customer_id <> v_customer
       OR COALESCE(v_existing.customer_address_id, v_zero) <> COALESCE(v_address, v_zero)
       OR COALESCE(v_existing.customer_contact_id, v_zero) <> COALESCE(v_contact, v_zero)
       OR v_existing.responsible_user_id <> v_responsible
       OR COALESCE(v_existing.assigned_technician_id, v_zero) <> COALESCE(v_tech, v_zero)
       OR v_existing.scheduled_start_at <> v_start
       OR v_existing.scheduled_end_at   <> v_end
       OR v_existing.title              <> v_title
       OR v_existing.visit_type         <> v_type
    THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    RETURN v_existing.id;
  END;

  INSERT INTO public.visit_events(
    company_id, visit_id, event_type, actor_user_id, event_data, client_request_id
  ) VALUES (
    v_company, v_visit_id, 'CREATED', v_user,
    jsonb_build_object('visit_number', v_number, 'title', v_title, 'visit_type', v_type),
    _client_request_id
  );

  PERFORM public.log_audit(
    'visits','create', v_visit_id, NULL,
    jsonb_build_object('visit_number', v_number, 'visit_type', v_type,
                       'customer_id', v_customer, 'assigned_technician_id', v_tech)
  );

  IF v_tech IS NOT NULL AND v_tech <> v_user THEN
    PERFORM public.notify_user(
      v_tech, v_company,
      'Nova visita atribuída',
      concat('Visita ', v_number, ' agendada para ', to_char(v_start,'DD/MM HH24:MI'), '.')
    );
  END IF;

  RETURN v_visit_id;
END; $$;

-- ---------------------------------------------------------------------
-- UPDATE_VISIT_SCHEDULE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_visit_schedule(
  _visit_id uuid,
  _payload  jsonb,
  _client_request_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_visit   public.visits;
  v_start   timestamptz := public._visit_parse_ts(_payload->>'scheduled_start_at','scheduled_start_at');
  v_end     timestamptz := public._visit_parse_ts(_payload->>'scheduled_end_at','scheduled_end_at');
  v_title   text := NULLIF(btrim(_payload->>'title'),'');
  v_desc    text := _payload->>'description';
  v_pre     text := _payload->>'pre_diagnosis';
  v_rec     text := _payload->>'recommended_solution';
  v_int     text := _payload->>'internal_notes';
  v_ev      public.visit_events;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.edit') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_visit FROM public.visits
    WHERE id = _visit_id AND company_id = v_company AND deleted_at IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;

  IF v_visit.status NOT IN ('DRAFT','SCHEDULED','CONFIRMED') THEN
    RAISE EXCEPTION 'schedule_not_editable';
  END IF;

  IF _client_request_id IS NOT NULL THEN
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF FOUND THEN
      IF v_ev.visit_id <> _visit_id OR v_ev.event_type <> 'SCHEDULED_UPDATED' THEN
        RAISE EXCEPTION 'idempotency_key_reused';
      END IF;
      RETURN;
    END IF;
  END IF;

  IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end <= v_start THEN
    RAISE EXCEPTION 'schedule_invalid_range';
  END IF;

  UPDATE public.visits SET
    scheduled_start_at   = COALESCE(v_start, scheduled_start_at),
    scheduled_end_at     = COALESCE(v_end,   scheduled_end_at),
    title                = COALESCE(v_title, title),
    description          = COALESCE(v_desc, description),
    pre_diagnosis        = COALESCE(v_pre, pre_diagnosis),
    recommended_solution = COALESCE(v_rec, recommended_solution),
    internal_notes       = COALESCE(v_int, internal_notes),
    updated_by           = v_user,
    updated_at           = now()
  WHERE id = _visit_id;

  BEGIN
    INSERT INTO public.visit_events(company_id, visit_id, event_type, actor_user_id, event_data, client_request_id)
      VALUES (v_company, _visit_id, 'SCHEDULED_UPDATED', v_user,
              jsonb_build_object('scheduled_start_at', v_start, 'scheduled_end_at', v_end, 'title', v_title),
              _client_request_id);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF NOT FOUND OR v_ev.visit_id <> _visit_id OR v_ev.event_type <> 'SCHEDULED_UPDATED' THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    RETURN;
  END;

  PERFORM public.log_audit('visits','update_schedule', _visit_id, NULL,
    jsonb_build_object('scheduled_start_at', v_start, 'scheduled_end_at', v_end));
END; $$;

-- ---------------------------------------------------------------------
-- ASSIGN_VISIT_TECHNICIAN
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_visit_technician(
  _visit_id uuid,
  _technician_id uuid,
  _client_request_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_visit   public.visits;
  v_ev      public.visit_events;
  v_evt     text;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.assign_technician') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_visit FROM public.visits
    WHERE id = _visit_id AND company_id = v_company AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;
  IF v_visit.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'visit_locked'; END IF;

  IF _technician_id IS NOT NULL THEN
    PERFORM 1 FROM public.profiles WHERE id = _technician_id AND company_id = v_company;
    IF NOT FOUND THEN RAISE EXCEPTION 'technician_cross_company'; END IF;
  END IF;

  IF _client_request_id IS NOT NULL THEN
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF FOUND THEN
      IF v_ev.visit_id <> _visit_id OR v_ev.event_type NOT IN ('ASSIGNED','UNASSIGNED') THEN
        RAISE EXCEPTION 'idempotency_key_reused';
      END IF;
      RETURN;
    END IF;
  END IF;

  UPDATE public.visits
     SET assigned_technician_id = _technician_id,
         updated_by = v_user, updated_at = now()
   WHERE id = _visit_id;

  v_evt := CASE WHEN _technician_id IS NULL THEN 'UNASSIGNED' ELSE 'ASSIGNED' END;

  BEGIN
    INSERT INTO public.visit_events(company_id, visit_id, event_type, actor_user_id, event_data, client_request_id)
      VALUES (v_company, _visit_id, v_evt, v_user,
              jsonb_build_object('technician_id', _technician_id), _client_request_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  IF _technician_id IS NOT NULL AND _technician_id <> v_user THEN
    PERFORM public.notify_user(_technician_id, v_company,
      'Visita atribuída a você',
      concat('Visita ', v_visit.visit_number, ' foi atribuída a você.'));
  END IF;
END; $$;

-- ---------------------------------------------------------------------
-- VISIT_EXECUTE_TRANSITION
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.visit_execute_transition(
  _visit_id uuid,
  _target   text,
  _payload  jsonb DEFAULT '{}'::jsonb,
  _client_request_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_visit   public.visits;
  v_ev      public.visit_events;
  v_ok      boolean := false;
  v_now     timestamptz := now();
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_visit FROM public.visits
    WHERE id = _visit_id AND company_id = v_company AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;

  -- idempotência pós-lock
  IF _client_request_id IS NOT NULL THEN
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF FOUND THEN
      IF v_ev.visit_id <> _visit_id OR v_ev.event_type <> _target THEN
        RAISE EXCEPTION 'idempotency_key_reused';
      END IF;
      RETURN;
    END IF;
  END IF;

  -- permissões e transições permitidas
  IF _target = 'CONFIRMED' THEN
    IF NOT public.has_permission('visits.edit') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('DRAFT','SCHEDULED');
  ELSIF _target = 'ON_THE_WAY' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('SCHEDULED','CONFIRMED');
  ELSIF _target = 'CHECKED_IN' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('SCHEDULED','CONFIRMED','ON_THE_WAY');
  ELSIF _target = 'COMPLETED' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
       AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_visit.service_order_id IS NOT NULL THEN RAISE EXCEPTION 'blocked_by_service_order'; END IF;
    v_ok := v_visit.status = 'CHECKED_IN';
  ELSIF _target = 'CANCELLED' THEN
    IF NOT public.has_permission('visits.cancel') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status NOT IN ('COMPLETED','CANCELLED');
  ELSIF _target = 'NO_SHOW' THEN
    IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_ok := v_visit.status IN ('SCHEDULED','CONFIRMED','ON_THE_WAY');
  ELSE
    RAISE EXCEPTION 'invalid_transition_target';
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
      VALUES (v_company, _visit_id, _target, v_user, COALESCE(_payload,'{}'::jsonb), _client_request_id);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF NOT FOUND OR v_ev.visit_id <> _visit_id OR v_ev.event_type <> _target THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    RETURN;
  END;
END; $$;

-- ---------------------------------------------------------------------
-- VISIT_CHECK_IN
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.visit_check_in(
  _visit_id          uuid,
  _lat               numeric,
  _lon               numeric,
  _accuracy_m        numeric,
  _manual_reason     text,
  _client_request_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_visit   public.visits;
  v_manual_raw text := NULLIF(btrim(COALESCE(_manual_reason,'')),'');
  v_manual  boolean := v_manual_raw IS NOT NULL;
  v_has_lat boolean := _lat IS NOT NULL;
  v_has_lon boolean := _lon IS NOT NULL;
  v_dist    numeric;
  v_ev      public.visit_events;
  v_payload jsonb;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _client_request_id IS NULL THEN RAISE EXCEPTION 'client_request_id_required'; END IF;

  SELECT * INTO v_visit FROM public.visits
    WHERE id = _visit_id AND company_id = v_company AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;
  IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
     AND NOT public.has_permission('visits.view') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_ev FROM public.visit_events
    WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
  IF FOUND THEN
    IF v_ev.visit_id <> _visit_id OR v_ev.event_type <> 'CHECKED_IN' THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    IF COALESCE((v_ev.event_data->>'latitude')::numeric,-999)  <> COALESCE(_lat,-999)
       OR COALESCE((v_ev.event_data->>'longitude')::numeric,-999) <> COALESCE(_lon,-999)
       OR COALESCE((v_ev.event_data->>'accuracy_m')::numeric,-1)  <> COALESCE(_accuracy_m,-1)
       OR COALESCE((v_ev.event_data->>'manual')::boolean,false)    <> v_manual
       OR COALESCE(v_ev.event_data->>'manual_reason','')            <> COALESCE(v_manual_raw,'')
    THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    RETURN;
  END IF;

  IF v_visit.status NOT IN ('SCHEDULED','CONFIRMED','ON_THE_WAY') THEN
    RAISE EXCEPTION 'checkin_invalid_status';
  END IF;

  IF v_manual AND (v_has_lat OR v_has_lon) THEN RAISE EXCEPTION 'gps_and_manual_reason_conflict'; END IF;
  IF v_manual AND _accuracy_m IS NOT NULL THEN RAISE EXCEPTION 'manual_accuracy_not_allowed'; END IF;
  IF NOT v_manual AND (v_has_lat <> v_has_lon) THEN RAISE EXCEPTION 'gps_pair_required'; END IF;
  IF NOT v_manual AND NOT v_has_lat THEN RAISE EXCEPTION 'manual_reason_required'; END IF;

  IF v_manual THEN
    IF length(v_manual_raw) < 5 THEN RAISE EXCEPTION 'manual_reason_too_short'; END IF;
    v_dist := NULL;
  ELSE
    IF _lat < -90  OR _lat > 90  THEN RAISE EXCEPTION 'invalid_latitude'; END IF;
    IF _lon < -180 OR _lon > 180 THEN RAISE EXCEPTION 'invalid_longitude'; END IF;
    IF _accuracy_m IS NOT NULL AND _accuracy_m < 0 THEN RAISE EXCEPTION 'invalid_accuracy'; END IF;
    v_dist := public._visit_distance_m(_visit_id, _lat, _lon);
  END IF;

  UPDATE public.visits
     SET checkin_latitude      = _lat,
         checkin_longitude     = _lon,
         checkin_accuracy_m    = _accuracy_m,
         checkin_distance_m    = v_dist,
         checkin_manual_reason = v_manual_raw,
         updated_by            = v_user,
         updated_at            = now()
   WHERE id = _visit_id;

  v_payload := jsonb_build_object(
    'latitude', _lat, 'longitude', _lon,
    'accuracy_m', _accuracy_m, 'distance_m', v_dist,
    'manual', v_manual, 'manual_reason', v_manual_raw
  );

  PERFORM public.visit_execute_transition(_visit_id, 'CHECKED_IN', v_payload, _client_request_id);
END; $$;

-- ---------------------------------------------------------------------
-- VISIT_CHECK_OUT
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.visit_check_out(
  _visit_id          uuid,
  _lat               numeric,
  _lon               numeric,
  _accuracy_m        numeric,
  _manual_reason     text,
  _client_request_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_visit   public.visits;
  v_so      public.service_orders;
  v_manual_raw text := NULLIF(btrim(COALESCE(_manual_reason,'')),'');
  v_manual  boolean := v_manual_raw IS NOT NULL;
  v_has_lat boolean := _lat IS NOT NULL;
  v_has_lon boolean := _lon IS NOT NULL;
  v_dist    numeric;
  v_ev      public.visit_events;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.execute') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _client_request_id IS NULL THEN RAISE EXCEPTION 'client_request_id_required'; END IF;

  SELECT * INTO v_visit FROM public.visits
    WHERE id = _visit_id AND company_id = v_company AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;
  IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
     AND NOT public.has_permission('visits.view') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_ev FROM public.visit_events
    WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
  IF FOUND THEN
    IF v_ev.visit_id <> _visit_id OR v_ev.event_type <> 'CHECKED_OUT' THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    IF COALESCE((v_ev.event_data->>'latitude')::numeric,-999)  <> COALESCE(_lat,-999)
       OR COALESCE((v_ev.event_data->>'longitude')::numeric,-999) <> COALESCE(_lon,-999)
       OR COALESCE((v_ev.event_data->>'accuracy_m')::numeric,-1)  <> COALESCE(_accuracy_m,-1)
       OR COALESCE((v_ev.event_data->>'manual')::boolean,false)    <> v_manual
       OR COALESCE(v_ev.event_data->>'manual_reason','')            <> COALESCE(v_manual_raw,'')
    THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    RETURN;
  END IF;

  IF v_visit.checked_out_at IS NOT NULL THEN RAISE EXCEPTION 'visit_already_checked_out'; END IF;
  IF v_visit.checked_in_at  IS NULL     THEN RAISE EXCEPTION 'checkout_before_checkin';   END IF;

  IF v_visit.service_order_id IS NULL THEN
    IF v_visit.status <> 'COMPLETED' THEN RAISE EXCEPTION 'checkout_requires_completed'; END IF;
  ELSE
    SELECT * INTO v_so FROM public.service_orders
      WHERE id = v_visit.service_order_id AND company_id = v_company;
    IF NOT FOUND THEN RAISE EXCEPTION 'service_order_missing'; END IF;
    IF v_so.status NOT IN ('PAUSED','COMPLETED','CANCELLED') THEN
      RAISE EXCEPTION 'blocked_by_service_order';
    END IF;
  END IF;

  IF v_manual AND (v_has_lat OR v_has_lon) THEN RAISE EXCEPTION 'gps_and_manual_reason_conflict'; END IF;
  IF v_manual AND _accuracy_m IS NOT NULL THEN RAISE EXCEPTION 'manual_accuracy_not_allowed'; END IF;
  IF NOT v_manual AND (v_has_lat <> v_has_lon) THEN RAISE EXCEPTION 'gps_pair_required'; END IF;
  IF NOT v_manual AND NOT v_has_lat THEN RAISE EXCEPTION 'manual_reason_required'; END IF;

  IF v_manual THEN
    IF length(v_manual_raw) < 5 THEN RAISE EXCEPTION 'manual_reason_too_short'; END IF;
    v_dist := NULL;
  ELSE
    IF _lat < -90  OR _lat > 90  THEN RAISE EXCEPTION 'invalid_latitude'; END IF;
    IF _lon < -180 OR _lon > 180 THEN RAISE EXCEPTION 'invalid_longitude'; END IF;
    IF _accuracy_m IS NOT NULL AND _accuracy_m < 0 THEN RAISE EXCEPTION 'invalid_accuracy'; END IF;
    v_dist := public._visit_distance_m(_visit_id, _lat, _lon);
  END IF;

  UPDATE public.visits
     SET checked_out_at         = now(),
         checkout_latitude      = _lat,
         checkout_longitude     = _lon,
         checkout_accuracy_m    = _accuracy_m,
         checkout_distance_m    = v_dist,
         checkout_manual_reason = v_manual_raw,
         updated_by             = v_user,
         updated_at             = now()
   WHERE id = _visit_id;

  BEGIN
    INSERT INTO public.visit_events(company_id, visit_id, event_type, actor_user_id, event_data, client_request_id)
      VALUES (v_company, _visit_id, 'CHECKED_OUT', v_user,
              jsonb_build_object('latitude', _lat, 'longitude', _lon,
                                 'accuracy_m', _accuracy_m, 'distance_m', v_dist,
                                 'manual', v_manual, 'manual_reason', v_manual_raw),
              _client_request_id);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_ev FROM public.visit_events
      WHERE company_id = v_company AND client_request_id = _client_request_id LIMIT 1;
    IF NOT FOUND OR v_ev.visit_id <> _visit_id OR v_ev.event_type <> 'CHECKED_OUT' THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    RETURN;
  END;

  PERFORM public.log_audit('visits','check_out', _visit_id, NULL,
    jsonb_build_object('checked_out_at', now(), 'manual', v_manual));
END; $$;

-- ---------------------------------------------------------------------
-- REGISTER_VISIT_PHOTO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_visit_photo(
  _visit_id       uuid,
  _file_path      text,
  _file_name      text,
  _mime_type      text,
  _file_size      bigint,
  _photo_category text,
  _caption        text,
  _sort_order     integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company   uuid := public.current_company_id();
  v_user      uuid := auth.uid();
  v_visit     public.visits;
  v_prefix    text;
  v_existing  public.visit_photos;
  v_obj       record;
  v_meta_mime text;
  v_meta_size bigint;
  v_photo_id  uuid;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.upload_photos') THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _file_name IS NULL OR length(btrim(_file_name)) = 0 THEN RAISE EXCEPTION 'file_name_required'; END IF;
  IF _photo_category NOT IN ('BEFORE','PROBLEM','DURING','AFTER','MATERIAL','OTHER') THEN
    RAISE EXCEPTION 'invalid_photo_category';
  END IF;
  IF _mime_type NOT IN ('image/jpeg','image/png','image/webp') THEN RAISE EXCEPTION 'unsupported_mime'; END IF;
  IF _file_size <= 0 OR _file_size > 10 * 1024 * 1024 THEN RAISE EXCEPTION 'invalid_file_size'; END IF;

  SELECT * INTO v_visit FROM public.visits
    WHERE id = _visit_id AND company_id = v_company AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;
  IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
     AND NOT public.has_permission('visits.view') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_prefix := v_company::text || '/visits/' || _visit_id::text || '/';
  IF position(v_prefix in _file_path) <> 1 THEN RAISE EXCEPTION 'file_path_mismatch'; END IF;

  SELECT * INTO v_existing FROM public.visit_photos WHERE file_path = _file_path;
  IF FOUND THEN
    IF v_existing.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'photo_path_archived'; END IF;
    IF v_existing.company_id <> v_company OR v_existing.visit_id <> _visit_id
       OR v_existing.mime_type <> _mime_type OR v_existing.file_size <> _file_size THEN
      RAISE EXCEPTION 'photo_path_reused';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT id, name, bucket_id, metadata INTO v_obj
    FROM storage.objects WHERE bucket_id = 'visit-photos' AND name = _file_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'uploaded_object_missing'; END IF;

  v_meta_mime := COALESCE(v_obj.metadata->>'mimetype', v_obj.metadata->>'contentType');
  v_meta_size := NULLIF(v_obj.metadata->>'size','')::bigint;
  IF v_meta_mime IS NOT NULL AND v_meta_mime <> _mime_type THEN RAISE EXCEPTION 'uploaded_object_metadata_mismatch'; END IF;
  IF v_meta_size IS NOT NULL AND v_meta_size <> _file_size THEN RAISE EXCEPTION 'uploaded_object_metadata_mismatch'; END IF;

  BEGIN
    INSERT INTO public.visit_photos(
      company_id, visit_id, uploaded_by,
      file_path, file_name, mime_type, file_size,
      photo_category, caption, sort_order
    ) VALUES (
      v_company, _visit_id, v_user,
      _file_path, _file_name, _mime_type, _file_size,
      _photo_category, _caption, COALESCE(_sort_order, 0)
    ) RETURNING id INTO v_photo_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing FROM public.visit_photos WHERE file_path = _file_path;
    IF NOT FOUND THEN RAISE; END IF;
    IF v_existing.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'photo_path_archived'; END IF;
    IF v_existing.company_id <> v_company OR v_existing.visit_id <> _visit_id
       OR v_existing.mime_type <> _mime_type OR v_existing.file_size <> _file_size THEN
      RAISE EXCEPTION 'photo_path_reused';
    END IF;
    RETURN v_existing.id;
  END;

  INSERT INTO public.visit_events(company_id, visit_id, event_type, actor_user_id, event_data)
    VALUES (v_company, _visit_id, 'PHOTO_ADDED', v_user,
            jsonb_build_object('photo_id', v_photo_id, 'file_path', _file_path,
                               'file_name', _file_name, 'mime_type', _mime_type,
                               'file_size', _file_size, 'photo_category', _photo_category));

  RETURN v_photo_id;
END; $$;

-- ---------------------------------------------------------------------
-- UPDATE_VISIT_PHOTO_CAPTION
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_visit_photo_caption(
  _photo_id uuid, _caption text, _sort_order integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_photo   public.visit_photos;
  v_visit   public.visits;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.upload_photos') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_photo FROM public.visit_photos
    WHERE id = _photo_id AND company_id = v_company AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'photo_not_found'; END IF;

  SELECT * INTO v_visit FROM public.visits WHERE id = v_photo.visit_id;
  IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
     AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.visit_photos
     SET caption = _caption,
         sort_order = COALESCE(_sort_order, sort_order),
         updated_at = now()
   WHERE id = _photo_id;

  INSERT INTO public.visit_events(company_id, visit_id, event_type, actor_user_id, event_data)
    VALUES (v_company, v_photo.visit_id, 'PHOTO_UPDATED', v_user,
            jsonb_build_object('photo_id', _photo_id, 'caption', _caption, 'sort_order', _sort_order));
END; $$;

-- ---------------------------------------------------------------------
-- SOFT_DELETE_VISIT_PHOTO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_visit_photo(_photo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
  v_photo   public.visit_photos;
  v_visit   public.visits;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_permission('visits.upload_photos') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_photo FROM public.visit_photos
    WHERE id = _photo_id AND company_id = v_company AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'photo_not_found'; END IF;

  SELECT * INTO v_visit FROM public.visits WHERE id = v_photo.visit_id;
  IF v_visit.assigned_technician_id IS DISTINCT FROM v_user
     AND NOT public.has_permission('visits.view') THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.visit_photos SET deleted_at = now(), updated_at = now() WHERE id = _photo_id;

  INSERT INTO public.visit_events(company_id, visit_id, event_type, actor_user_id, event_data)
    VALUES (v_company, v_photo.visit_id, 'PHOTO_REMOVED', v_user,
            jsonb_build_object('photo_id', _photo_id));
END; $$;

-- ---------------------------------------------------------------------
-- LIST_MY_VISITS (técnico) — assinatura (date, date, text)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_visits(
  _from date, _to date, _status text DEFAULT NULL
) RETURNS SETOF public.visits
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.* FROM public.visits v
   WHERE v.deleted_at IS NULL
     AND v.company_id = public.current_company_id()
     AND v.assigned_technician_id = auth.uid()
     AND (
       public.has_permission('visits.view_assigned_only')
       OR public.has_permission('visits.view')
     )
     AND (_from IS NULL OR v.scheduled_start_at::date >= _from)
     AND (_to   IS NULL OR v.scheduled_start_at::date <= _to)
     AND (_status IS NULL OR v.status = _status)
   ORDER BY v.scheduled_start_at ASC;
$$;

-- ---------------------------------------------------------------------
-- LIST_VISITS_FOR_CALENDAR (gestor) — assinatura (date, date, text)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_visits_for_calendar(
  _from date, _to date, _status text DEFAULT NULL
) RETURNS SETOF public.visits
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.* FROM public.visits v
   WHERE v.deleted_at IS NULL
     AND v.company_id = public.current_company_id()
     AND public.has_permission('visits.view')
     AND (_from IS NULL OR v.scheduled_start_at::date >= _from)
     AND (_to   IS NULL OR v.scheduled_start_at::date <= _to)
     AND (_status IS NULL OR v.status = _status);
$$;

-- =====================================================================
-- OWNERS / GRANTS / REVOKES
-- =====================================================================

-- Helpers INTERNOS: sem EXECUTE para roles do Data API
ALTER FUNCTION public._visit_parse_ts(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._visit_parse_ts(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._visit_parse_ts(text,text) FROM anon;
REVOKE ALL ON FUNCTION public._visit_parse_ts(text,text) FROM authenticated;

ALTER FUNCTION public._visit_distance_m(uuid,numeric,numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._visit_distance_m(uuid,numeric,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._visit_distance_m(uuid,numeric,numeric) FROM anon;
REVOKE ALL ON FUNCTION public._visit_distance_m(uuid,numeric,numeric) FROM authenticated;

ALTER FUNCTION public.next_visit_number(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.next_visit_number(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_visit_number(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.next_visit_number(uuid) FROM authenticated;

-- RPCs públicas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT sig FROM (VALUES
      ('public.create_visit(jsonb,uuid)'),
      ('public.update_visit_schedule(uuid,jsonb,uuid)'),
      ('public.assign_visit_technician(uuid,uuid,uuid)'),
      ('public.visit_execute_transition(uuid,text,jsonb,uuid)'),
      ('public.visit_check_in(uuid,numeric,numeric,numeric,text,uuid)'),
      ('public.visit_check_out(uuid,numeric,numeric,numeric,text,uuid)'),
      ('public.register_visit_photo(uuid,text,text,text,bigint,text,text,integer)'),
      ('public.update_visit_photo_caption(uuid,text,integer)'),
      ('public.soft_delete_visit_photo(uuid)'),
      ('public.list_my_visits(date,date,text)'),
      ('public.list_visits_for_calendar(date,date,text)')
    ) AS t(sig)
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;
