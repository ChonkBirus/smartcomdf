-- 1) Table
CREATE TABLE public.finance_monthly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_goal numeric(14,2),
  expense_cap numeric(14,2),
  profit_goal numeric(14,2),
  margin_goal_pct numeric(5,2),
  cash_min numeric(14,2),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_monthly_plans_unique UNIQUE (company_id, year, month)
);

CREATE INDEX idx_finance_monthly_plans_company_year
  ON public.finance_monthly_plans(company_id, year);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_monthly_plans TO authenticated;
GRANT ALL ON public.finance_monthly_plans TO service_role;

-- 3) RLS
ALTER TABLE public.finance_monthly_plans ENABLE ROW LEVEL SECURITY;

-- 4) Policies
CREATE POLICY "fmp_select_own_company"
  ON public.finance_monthly_plans
  FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "fmp_insert_own_company"
  ON public.finance_monthly_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "fmp_update_own_company"
  ON public.finance_monthly_plans
  FOR UPDATE
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "fmp_delete_own_company"
  ON public.finance_monthly_plans
  FOR DELETE
  TO authenticated
  USING (company_id = public.current_company_id());

-- updated_at trigger (reuse pattern)
CREATE OR REPLACE FUNCTION public.tg_finance_monthly_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_finance_monthly_plans_updated_at
BEFORE UPDATE ON public.finance_monthly_plans
FOR EACH ROW EXECUTE FUNCTION public.tg_finance_monthly_plans_updated_at();

-- 5) New permission and role bindings
INSERT INTO public.permissions (slug, module, action, description)
VALUES ('finance.planning.manage', 'finance', 'planning.manage',
  'Gerenciar metas mensais em Planejamento Financeiro')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.slug = 'finance.planning.manage'
  AND r.slug IN ('owner', 'manager', 'financial')
ON CONFLICT DO NOTHING;
