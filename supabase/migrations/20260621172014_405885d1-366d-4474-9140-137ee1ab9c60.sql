
-- =========================================================
-- FEATURES (catálogo)
-- =========================================================
CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.features TO authenticated, anon;
GRANT ALL ON public.features TO service_role;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Features são públicas para leitura" ON public.features FOR SELECT USING (true);
CREATE TRIGGER trg_features_updated BEFORE UPDATE ON public.features FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.features IS 'Catálogo de funcionalidades do SecureERP (feature flags)';

-- =========================================================
-- PLAN_FEATURES (relacionamento)
-- =========================================================
CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_id)
);
GRANT SELECT ON public.plan_features TO authenticated, anon;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan features são públicos para leitura" ON public.plan_features FOR SELECT USING (true);

CREATE INDEX idx_plan_features_plan ON public.plan_features(plan_id);
CREATE INDEX idx_plan_features_feature ON public.plan_features(feature_id);

-- =========================================================
-- LIMITES EXTRAS EM PLANS (extensibilidade)
-- =========================================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_customers INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_products INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_service_orders INTEGER NOT NULL DEFAULT 0;

-- =========================================================
-- SEED FEATURES
-- =========================================================
INSERT INTO public.features (code, name, description, category) VALUES
  ('dashboard',      'Dashboard',           'Visão geral e indicadores',        'core'),
  ('products',       'Produtos',            'Cadastro de produtos',             'cadastros'),
  ('inventory',      'Estoque',             'Controle de estoque',              'operacao'),
  ('customers',      'Clientes',            'Cadastro de clientes',             'cadastros'),
  ('quotes',         'Orçamentos',          'Geração de orçamentos',            'operacao'),
  ('crm',            'CRM',                 'Pipeline de vendas e oportunidades','gestao'),
  ('financial',      'Financeiro',          'Contas a pagar e receber',         'gestao'),
  ('service_orders', 'Ordens de Serviço',   'Gestão de OS técnicas',            'gestao'),
  ('nfe',            'Nota Fiscal Eletrônica','Emissão de NFe',                  'fiscal'),
  ('pix',            'PIX',                 'Pagamentos e cobranças PIX',       'fiscal'),
  ('reports',        'Relatórios',          'Relatórios gerenciais',            'sistema'),
  ('settings',       'Configurações',       'Configurações da empresa',         'sistema'),
  ('users',          'Usuários',            'Gestão de usuários e convites',    'sistema'),
  ('notifications',  'Notificações',        'Central de notificações',          'sistema'),
  ('audit',          'Auditoria',           'Logs e auditoria',                 'sistema')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- SEED PLAN_FEATURES
-- =========================================================
DO $$
DECLARE
  p_starter UUID;
  p_pro UUID;
  p_business UUID;
  starter_codes TEXT[] := ARRAY['dashboard','products','inventory','customers','quotes','reports','users','settings','notifications','audit'];
  pro_codes TEXT[] := ARRAY['dashboard','products','inventory','customers','quotes','crm','financial','reports','users','settings','notifications','audit'];
  f RECORD;
BEGIN
  SELECT id INTO p_starter FROM public.plans WHERE slug='starter';
  SELECT id INTO p_pro     FROM public.plans WHERE slug='pro';
  SELECT id INTO p_business FROM public.plans WHERE slug='business';

  FOR f IN SELECT id, code FROM public.features LOOP
    IF p_starter IS NOT NULL THEN
      INSERT INTO public.plan_features (plan_id, feature_id, enabled)
        VALUES (p_starter, f.id, f.code = ANY(starter_codes))
        ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = EXCLUDED.enabled;
    END IF;
    IF p_pro IS NOT NULL THEN
      INSERT INTO public.plan_features (plan_id, feature_id, enabled)
        VALUES (p_pro, f.id, f.code = ANY(pro_codes))
        ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = EXCLUDED.enabled;
    END IF;
    IF p_business IS NOT NULL THEN
      INSERT INTO public.plan_features (plan_id, feature_id, enabled)
        VALUES (p_business, f.id, TRUE)
        ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = EXCLUDED.enabled;
    END IF;
  END LOOP;

  -- Atualiza limites por plano (extensibilidade)
  UPDATE public.plans SET max_customers=100,  max_products=200,  max_service_orders=50   WHERE slug='starter';
  UPDATE public.plans SET max_customers=1000, max_products=2000, max_service_orders=500  WHERE slug='pro';
  UPDATE public.plans SET max_customers=0,    max_products=0,    max_service_orders=0    WHERE slug='business'; -- 0 = ilimitado
END $$;

-- =========================================================
-- FUNÇÕES DE VERIFICAÇÃO
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_feature(_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid UUID;
  pid UUID;
  ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  IF public.is_super_admin() THEN RETURN TRUE; END IF;

  SELECT company_id INTO cid FROM public.profiles WHERE id = auth.uid();
  IF cid IS NULL THEN RETURN FALSE; END IF;

  SELECT plan_id INTO pid FROM public.companies WHERE id = cid;
  IF pid IS NULL THEN RETURN FALSE; END IF;

  SELECT pf.enabled INTO ok
  FROM public.plan_features pf
  JOIN public.features f ON f.id = pf.feature_id
  WHERE pf.plan_id = pid AND f.code = _code AND f.active = TRUE;

  RETURN COALESCE(ok, FALSE);
END $$;

CREATE OR REPLACE FUNCTION public.get_my_features()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid UUID;
  pid UUID;
  result TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN ARRAY[]::TEXT[]; END IF;

  IF public.is_super_admin() THEN
    SELECT array_agg(code) INTO result FROM public.features WHERE active = TRUE;
    RETURN COALESCE(result, ARRAY[]::TEXT[]);
  END IF;

  SELECT company_id INTO cid FROM public.profiles WHERE id = auth.uid();
  IF cid IS NULL THEN RETURN ARRAY[]::TEXT[]; END IF;

  SELECT plan_id INTO pid FROM public.companies WHERE id = cid;
  IF pid IS NULL THEN RETURN ARRAY[]::TEXT[]; END IF;

  SELECT array_agg(f.code) INTO result
  FROM public.plan_features pf
  JOIN public.features f ON f.id = pf.feature_id
  WHERE pf.plan_id = pid AND pf.enabled = TRUE AND f.active = TRUE;

  RETURN COALESCE(result, ARRAY[]::TEXT[]);
END $$;
