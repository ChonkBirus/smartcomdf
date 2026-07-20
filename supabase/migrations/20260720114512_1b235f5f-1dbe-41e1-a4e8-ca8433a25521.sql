
-- =============================================================
-- 1) Nova permissão
-- =============================================================
INSERT INTO public.permissions (slug, module, action, description)
VALUES ('employees.manage', 'employees', 'manage',
        'Gerenciar cadastro de funcionários operacionais e custos vinculados')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================
-- 2) Predicados reutilizáveis
--     app_role válidos: super_admin, owner, manager, financial,
--                       commercial, stock, technician
-- =============================================================
CREATE OR REPLACE FUNCTION public.can_view_employee_costs()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_company_role('owner'::public.app_role)
    OR public.has_company_role('manager'::public.app_role)
    OR public.has_company_role('financial'::public.app_role)
    OR public.has_permission('employees.manage')
    OR public.has_permission('finance.view_costs')
    OR public.has_permission('finance.manage');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_view_employee_costs()
    OR public.has_permission('projects.edit')
    OR public.has_permission('projects.manage_team')
    OR public.has_permission('service_orders.edit');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_employees()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_company_role('owner'::public.app_role)
    OR public.has_company_role('manager'::public.app_role)
    OR public.has_permission('employees.manage');
$$;

-- =============================================================
-- 3) Tabela employees
-- =============================================================
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  document text,
  role text,
  daily_rate numeric(12,2) NOT NULL DEFAULT 0,
  transport_cost numeric(12,2) NOT NULL DEFAULT 0,
  meal_cost numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX employees_company_active_idx
  ON public.employees(company_id, active)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select_costs ON public.employees
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.can_view_employee_costs()
  );

CREATE POLICY employees_insert ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.can_manage_employees()
  );

CREATE POLICY employees_update ON public.employees
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.can_manage_employees()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.can_manage_employees()
  );

CREATE POLICY employees_delete ON public.employees
  FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.can_manage_employees()
  );

CREATE TRIGGER employees_set_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- 4) Tabela project_employee_costs
-- =============================================================
CREATE TABLE public.project_employee_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  role_snapshot text,
  daily_rate_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  days_count numeric(10,2) NOT NULL DEFAULT 1,
  transport_cost numeric(12,2) NOT NULL DEFAULT 0,
  meal_cost numeric(12,2) NOT NULL DEFAULT 0,
  other_cost numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX pec_project_idx
  ON public.project_employee_costs(project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX pec_service_order_idx
  ON public.project_employee_costs(service_order_id)
  WHERE deleted_at IS NULL;

CREATE INDEX pec_employee_idx
  ON public.project_employee_costs(employee_id)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_employee_costs TO authenticated;
GRANT ALL ON public.project_employee_costs TO service_role;

ALTER TABLE public.project_employee_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pec_select_costs ON public.project_employee_costs
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.can_view_employee_costs()
  );

CREATE POLICY pec_insert_manage ON public.project_employee_costs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.can_manage_project_team()
  );

CREATE POLICY pec_update_costs ON public.project_employee_costs
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.can_view_employee_costs()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.can_view_employee_costs()
  );

CREATE POLICY pec_delete_costs ON public.project_employee_costs
  FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.can_view_employee_costs()
  );

CREATE TRIGGER pec_set_updated_at
  BEFORE UPDATE ON public.project_employee_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- 5) RPC pública SEM valores — para técnico/responsável da OS
-- =============================================================
CREATE OR REPLACE FUNCTION public.list_service_order_team_public(_service_order_id uuid)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  employee_name text,
  role_snapshot text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_assigned uuid;
  v_responsible uuid;
BEGIN
  SELECT so.company_id, so.assigned_technician_id, so.responsible_user_id
    INTO v_company_id, v_assigned, v_responsible
  FROM public.service_orders so
  WHERE so.id = _service_order_id;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  IF v_company_id <> public.current_company_id() THEN
    RETURN;
  END IF;

  IF NOT (
    public.can_view_employee_costs()
    OR public.can_manage_project_team()
    OR auth.uid() = v_assigned
    OR auth.uid() = v_responsible
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pec.id,
         pec.employee_id,
         e.name AS employee_name,
         pec.role_snapshot
  FROM public.project_employee_costs pec
  JOIN public.employees e ON e.id = pec.employee_id
  WHERE pec.service_order_id = _service_order_id
    AND pec.deleted_at IS NULL
  ORDER BY e.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_service_order_team_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_service_order_team_public(uuid) TO authenticated;
