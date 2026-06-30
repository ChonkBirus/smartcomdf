
CREATE TABLE IF NOT EXISTS public.company_cost_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  monthly_fixed_costs_total numeric(14,2) NOT NULL DEFAULT 0,
  monthly_operational_costs_total numeric(14,2) NOT NULL DEFAULT 0,
  expected_monthly_revenue numeric(14,2),
  expected_monthly_sales_count integer,
  default_tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  default_card_fee_rate numeric(7,4) NOT NULL DEFAULT 0,
  default_commission_rate numeric(7,4) NOT NULL DEFAULT 0,
  default_warranty_reserve_rate numeric(7,4) NOT NULL DEFAULT 0,
  default_operational_cost_rate numeric(7,4) NOT NULL DEFAULT 0,
  default_fixed_cost_allocation_rate numeric(7,4) NOT NULL DEFAULT 0,
  default_desired_margin_rate numeric(7,4) NOT NULL DEFAULT 30,
  allocation_method text NOT NULL DEFAULT 'PERCENT_OF_REVENUE'
    CHECK (allocation_method IN ('PERCENT_OF_REVENUE','FIXED_PER_SALE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_cost_settings_company_unique UNIQUE (company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_cost_settings TO authenticated;
GRANT ALL ON public.company_cost_settings TO service_role;

ALTER TABLE public.company_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccs_select_members" ON public.company_cost_settings
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "ccs_insert_managers" ON public.company_cost_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_member(company_id)
    AND public.has_permission('finance.manage_cost_settings')
  );

CREATE POLICY "ccs_update_managers" ON public.company_cost_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_company_member(company_id)
    AND public.has_permission('finance.manage_cost_settings')
  )
  WITH CHECK (
    public.is_company_member(company_id)
    AND public.has_permission('finance.manage_cost_settings')
  );

CREATE POLICY "ccs_delete_managers" ON public.company_cost_settings
  FOR DELETE TO authenticated
  USING (
    public.is_company_member(company_id)
    AND public.has_permission('finance.manage_cost_settings')
  );

CREATE TRIGGER company_cost_settings_set_updated_at
  BEFORE UPDATE ON public.company_cost_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pricing_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  additional_costs numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  card_fee_rate numeric(7,4) NOT NULL DEFAULT 0,
  commission_rate numeric(7,4) NOT NULL DEFAULT 0,
  warranty_reserve_rate numeric(7,4) NOT NULL DEFAULT 0,
  operational_cost_rate numeric(7,4) NOT NULL DEFAULT 0,
  fixed_cost_allocation_rate numeric(7,4) NOT NULL DEFAULT 0,
  desired_margin_rate numeric(7,4) NOT NULL DEFAULT 0,
  suggested_price numeric(14,2) NOT NULL DEFAULT 0,
  current_price numeric(14,2),
  estimated_profit numeric(14,2) NOT NULL DEFAULT 0,
  estimated_margin_rate numeric(7,4) NOT NULL DEFAULT 0,
  markup_multiplier numeric(10,4) NOT NULL DEFAULT 0,
  markup_percentage numeric(10,4) NOT NULL DEFAULT 0,
  applied_to_item boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pricing_simulations_company_created_idx
  ON public.pricing_simulations (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_simulations_item_idx
  ON public.pricing_simulations (item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_simulations TO authenticated;
GRANT ALL ON public.pricing_simulations TO service_role;

ALTER TABLE public.pricing_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select_pricing_view" ON public.pricing_simulations
  FOR SELECT TO authenticated
  USING (
    public.is_company_member(company_id)
    AND public.has_permission('finance.pricing.view')
  );

CREATE POLICY "ps_insert_pricing_manage" ON public.pricing_simulations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_member(company_id)
    AND public.has_permission('finance.pricing.manage')
  );

CREATE POLICY "ps_update_pricing_manage" ON public.pricing_simulations
  FOR UPDATE TO authenticated
  USING (
    public.is_company_member(company_id)
    AND public.has_permission('finance.pricing.manage')
  )
  WITH CHECK (
    public.is_company_member(company_id)
    AND public.has_permission('finance.pricing.manage')
  );

CREATE POLICY "ps_delete_pricing_manage" ON public.pricing_simulations
  FOR DELETE TO authenticated
  USING (
    public.is_company_member(company_id)
    AND public.has_permission('finance.pricing.manage')
  );

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('finance.pricing.view',          'finance', 'pricing.view',          'Visualizar precificação e simulações'),
  ('finance.pricing.manage',        'finance', 'pricing.manage',        'Criar, editar e salvar simulações de precificação'),
  ('finance.apply_suggested_price', 'finance', 'apply_suggested_price', 'Aplicar preço sugerido em um produto'),
  ('finance.manage_cost_settings',  'finance', 'manage_cost_settings',  'Configurar custos da empresa para precificação')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'financial'
  AND p.slug IN (
    'finance.pricing.view',
    'finance.pricing.manage',
    'finance.apply_suggested_price',
    'finance.manage_cost_settings'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'manager'
  AND p.slug = 'finance.pricing.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
