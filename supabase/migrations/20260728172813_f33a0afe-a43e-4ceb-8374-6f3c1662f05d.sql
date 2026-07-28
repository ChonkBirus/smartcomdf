DROP FUNCTION IF EXISTS public.list_visits_for_calendar(date, date, text);

CREATE FUNCTION public.list_visits_for_calendar(
  _from  date,
  _to    date,
  _scope text DEFAULT 'mine'
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_user    uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'no_company';
  END IF;

  IF _scope NOT IN ('all', 'mine') THEN
    RAISE EXCEPTION 'invalid_scope';
  END IF;

  IF _from IS NULL OR _to IS NULL OR _to < _from THEN
    RAISE EXCEPTION 'invalid_range';
  END IF;

  IF (_to - _from) > 93 THEN
    RAISE EXCEPTION 'range_too_large';
  END IF;

  IF NOT (
    public.has_permission('visits.view')
    OR public.has_permission('visits.view_assigned_only')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _scope = 'all'
     AND NOT public.has_permission('visits.view') THEN
    RAISE EXCEPTION 'forbidden_scope_all';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(calendar_row)
  FROM (
    SELECT
      v.id,
      v.visit_number,
      v.title,
      v.status,
      v.visit_type,
      v.scheduled_start_at,
      v.scheduled_end_at,
      v.assigned_technician_id,
      v.customer_id,
      v.customer_address_id,
      v.service_order_id,
      v.checked_in_at,
      v.checked_out_at
    FROM public.visits v
    WHERE v.company_id = v_company
      AND v.deleted_at IS NULL
      AND v.scheduled_start_at IS NOT NULL
      AND v.scheduled_start_at::date BETWEEN _from AND _to
      AND (
        (
          _scope = 'all'
          AND public.has_permission('visits.view')
        )
        OR
        (
          _scope = 'mine'
          AND v.assigned_technician_id = v_user
          AND (
            public.has_permission('visits.view')
            OR public.has_permission('visits.view_assigned_only')
          )
        )
      )
    ORDER BY v.scheduled_start_at ASC
    LIMIT 2000
  ) AS calendar_row;
END;
$$;

ALTER FUNCTION public.list_visits_for_calendar(date, date, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.list_visits_for_calendar(date, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_visits_for_calendar(date, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_visits_for_calendar(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_visits_for_calendar(date, date, text) TO service_role;

NOTIFY pgrst, 'reload schema';