CREATE OR REPLACE FUNCTION public.list_active_employees_for_picker()
RETURNS TABLE (
  id uuid,
  name text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado'
      USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.can_view_employee_costs()
    OR public.can_manage_employees()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para listar funcionários'
      USING ERRCODE = '42501';
  END IF;

  _company_id := public.current_company_id();

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Sem empresa vinculada'
      USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.role
  FROM public.employees e
  WHERE e.company_id = _company_id
    AND e.active = true
    AND e.deleted_at IS NULL
  ORDER BY e.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_active_employees_for_picker() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_active_employees_for_picker() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_active_employees_for_picker() TO authenticated;

ALTER FUNCTION public.list_active_employees_for_picker() OWNER TO postgres;