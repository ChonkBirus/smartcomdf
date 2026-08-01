-- ============================================================
-- VIS-DRIFT-01 — customer_addresses coords + create_visit snapshot fix
-- ============================================================
DO $mig$
DECLARE
  r record;
BEGIN
  -- ---- latitude ----
  SELECT data_type, is_nullable, numeric_precision, numeric_scale
    INTO r
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='customer_addresses' AND column_name='latitude';
  IF NOT FOUND THEN
    ALTER TABLE public.customer_addresses ADD COLUMN latitude numeric(9,6);
  ELSE
    IF r.data_type <> 'numeric' OR r.is_nullable <> 'YES'
       OR COALESCE(r.numeric_precision,0) <> 9 OR COALESCE(r.numeric_scale,-1) <> 6 THEN
      RAISE EXCEPTION 'drift_guard: customer_addresses.latitude incompatible (type=%, nullable=%, prec=%, scale=%)',
        r.data_type, r.is_nullable, r.numeric_precision, r.numeric_scale;
    END IF;
  END IF;

  -- ---- longitude ----
  SELECT data_type, is_nullable, numeric_precision, numeric_scale
    INTO r
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='customer_addresses' AND column_name='longitude';
  IF NOT FOUND THEN
    ALTER TABLE public.customer_addresses ADD COLUMN longitude numeric(9,6);
  ELSE
    IF r.data_type <> 'numeric' OR r.is_nullable <> 'YES'
       OR COALESCE(r.numeric_precision,0) <> 9 OR COALESCE(r.numeric_scale,-1) <> 6 THEN
      RAISE EXCEPTION 'drift_guard: customer_addresses.longitude incompatible (type=%, nullable=%, prec=%, scale=%)',
        r.data_type, r.is_nullable, r.numeric_precision, r.numeric_scale;
    END IF;
  END IF;

  -- ---- guard: no zip_code column must be introduced ----
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='customer_addresses' AND column_name='zip_code';
  IF FOUND THEN
    RAISE EXCEPTION 'drift_guard: unexpected column customer_addresses.zip_code';
  END IF;
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='customer_addresses' AND column_name='zipcode';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'drift_guard: missing column customer_addresses.zipcode';
  END IF;
END $mig$;

-- ---- named range / pairing constraints (idempotent) ----
ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_lat_range;
ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_lon_range;
ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_latlon_pair;

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_lat_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_lon_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_latlon_pair
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  );

-- ============================================================
-- create_visit — snapshot uses zipcode column, JSON key stays zip_code
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_visit(_payload jsonb, _client_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- coordinates come EXCLUSIVELY from customer_addresses (never from payload)
    v_addr_snap := jsonb_build_object(
      'address_type', v_addr_row.address_type,
      'zip_code',     v_addr_row.zipcode,
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
END; $function$;

-- final signature guard
DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='create_visit'
     AND pg_get_function_identity_arguments(p.oid) IN ('jsonb, uuid', '_payload jsonb, _client_request_id uuid');
  IF n <> 1 THEN RAISE EXCEPTION 'drift_guard: create_visit signature mismatch (%)', n; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
              WHERE ns.nspname='public' AND p.proname='create_visit'
                AND pg_get_functiondef(p.oid) LIKE '%v_addr_row.zip_code%') THEN
    RAISE EXCEPTION 'drift_guard: create_visit still references v_addr_row.zip_code';
  END IF;
END $chk$;