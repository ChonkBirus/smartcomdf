
-- =========================================================
-- FASE 2.16A: Módulo Financeiro (base)
-- =========================================================

-- 1. financial_categories
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('INCOME','EXPENSE')),
  parent_id uuid NULL REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name, type)
);
CREATE INDEX IF NOT EXISTS idx_fin_cat_company ON public.financial_categories(company_id, type, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_categories TO service_role;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_cat_select" ON public.financial_categories
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "fin_cat_insert" ON public.financial_categories
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "fin_cat_update" ON public.financial_categories
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "fin_cat_delete" ON public.financial_categories
  FOR DELETE TO authenticated USING (public.is_company_member(company_id) AND is_default = false);

-- 2. financial_transactions
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('INCOME','EXPENSE')),
  category_id uuid NULL REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  due_date date NULL,
  paid_at timestamptz NULL,
  status text NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','PAID','OVERDUE','CANCELED','RECONCILED')),
  customer_id uuid NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quote_id uuid NULL REFERENCES public.quotes(id) ON DELETE SET NULL,
  project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  service_order_id uuid NULL REFERENCES public.service_orders(id) ON DELETE SET NULL,
  purchase_id uuid NULL REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  payment_method text NULL,
  origin text NOT NULL DEFAULT 'MANUAL'
    CHECK (origin IN ('MANUAL','QUOTE','PAYMENT','PURCHASE','SERVICE_ORDER','OPEN_FINANCE','IMPORT')),
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_fin_tx_company_type_status ON public.financial_transactions(company_id, type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_tx_company_due ON public.financial_transactions(company_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_tx_company_paid ON public.financial_transactions(company_id, paid_at) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_tx_select" ON public.financial_transactions
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) AND deleted_at IS NULL);
CREATE POLICY "fin_tx_insert" ON public.financial_transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id) AND created_by = auth.uid());
CREATE POLICY "fin_tx_update" ON public.financial_transactions
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
-- No DELETE policy → hard delete blocked; use soft delete via UPDATE.

-- 3. updated_at trigger (reuse existing util if present, else create)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_fin_cat_updated ON public.financial_categories;
CREATE TRIGGER trg_fin_cat_updated BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_fin_tx_updated ON public.financial_transactions;
CREATE TRIGGER trg_fin_tx_updated BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Seed default categories RPC
CREATE OR REPLACE FUNCTION public.seed_default_financial_categories(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _income text[] := ARRAY[
    'Instalação de CFTV','Manutenção de CFTV','Controle de acesso','Interfonia',
    'Alarmes','Redes','Automação','Energia solar','Carregador veicular',
    'Venda de equipamentos','Contrato recorrente','Som ambiente','Painel de LED','Outro'
  ];
  _expense text[] := ARRAY[
    'Compra de equipamentos','Cabos e infraestrutura','Ferramentas','Combustível',
    'Veículos','Salários','Pró-labore','Impostos','Taxas de cartão','Aluguel',
    'Internet e telefone','Sistemas','Marketing','Frete','Terceirizados',
    'Manutenção','Garantia e retrabalho','Outros'
  ];
  _n text;
BEGIN
  IF NOT public.is_company_member(_company_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  FOREACH _n IN ARRAY _income LOOP
    INSERT INTO public.financial_categories (company_id, name, type, is_default)
    VALUES (_company_id, _n, 'INCOME', true)
    ON CONFLICT (company_id, name, type) DO NOTHING;
  END LOOP;
  FOREACH _n IN ARRAY _expense LOOP
    INSERT INTO public.financial_categories (company_id, name, type, is_default)
    VALUES (_company_id, _n, 'EXPENSE', true)
    ON CONFLICT (company_id, name, type) DO NOTHING;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.seed_default_financial_categories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_financial_categories(uuid) TO authenticated;

-- 5. Permissions catalog
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('finance.view','finance','view','Visualizar módulo financeiro'),
  ('finance.manage','finance','manage','Gerenciar módulo financeiro'),
  ('finance.cashflow.view','finance','cashflow.view','Ver fluxo de caixa'),
  ('finance.income.manage','finance','income.manage','Gerenciar entradas'),
  ('finance.expense.manage','finance','expense.manage','Gerenciar saídas'),
  ('finance.receivables.manage','finance','receivables.manage','Gerenciar contas a receber'),
  ('finance.payables.manage','finance','payables.manage','Gerenciar contas a pagar'),
  ('finance.categories.manage','finance','categories.manage','Gerenciar categorias financeiras'),
  ('finance.view_costs','finance','view_costs','Ver custos e margens')
ON CONFLICT (slug) DO NOTHING;

-- 6. Grant finance.* to owner role (and financial role if exists)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('owner','financial')
  AND p.slug LIKE 'finance.%'
ON CONFLICT DO NOTHING;
