
ALTER TABLE public.company_cost_settings
  ADD COLUMN IF NOT EXISTS pro_labore_percent numeric NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS pro_labore_value numeric;

CREATE TABLE IF NOT EXISTS public.company_fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_fixed_costs TO authenticated;
GRANT ALL ON public.company_fixed_costs TO service_role;

ALTER TABLE public.company_fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfc_select_same_company"
  ON public.company_fixed_costs FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_permission('finance.view_costs') OR public.has_permission('finance.manage_cost_settings') OR public.has_permission('finance.manage'))
  );

CREATE POLICY "cfc_write_same_company"
  ON public.company_fixed_costs FOR ALL TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_permission('finance.manage_cost_settings') OR public.has_permission('finance.manage'))
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_permission('finance.manage_cost_settings') OR public.has_permission('finance.manage'))
  );

CREATE INDEX IF NOT EXISTS idx_cfc_company ON public.company_fixed_costs(company_id, active);

CREATE TRIGGER trg_cfc_updated_at
  BEFORE UPDATE ON public.company_fixed_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
