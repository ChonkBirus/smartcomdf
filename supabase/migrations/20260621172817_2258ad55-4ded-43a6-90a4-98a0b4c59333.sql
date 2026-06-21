
-- Novas features
INSERT INTO public.features (code, name, description, category) VALUES
  ('ocr',              'OCR de documentos',  'Reconhecimento óptico de caracteres', 'avancado'),
  ('excel_import',     'Importação Excel',   'Importação em massa via planilhas',   'avancado'),
  ('reports_basic',    'Relatórios básicos', 'Relatórios essenciais',               'sistema'),
  ('reports_advanced', 'Relatórios avançados','Relatórios analíticos avançados',    'sistema'),
  ('api_access',       'Acesso à API',       'Acesso completo à API REST',          'integracoes'),
  ('white_label',      'White Label',        'Personalização de marca (preparado)', 'integracoes')
ON CONFLICT (code) DO NOTHING;

-- Atualiza limites
UPDATE public.plans SET max_users=3,   max_storage_gb=5,   max_customers=100,  max_products=200,  max_service_orders=50   WHERE slug='starter';
UPDATE public.plans SET max_users=10,  max_storage_gb=20,  max_customers=1000, max_products=2000, max_service_orders=500  WHERE slug='pro';
UPDATE public.plans SET max_users=0,   max_storage_gb=100, max_customers=0,    max_products=0,    max_service_orders=0    WHERE slug='business';

-- Reaplica mapeamento plan_features conforme novo escopo
DO $$
DECLARE
  p_starter UUID;
  p_pro UUID;
  p_business UUID;
  starter_codes TEXT[] := ARRAY[
    'dashboard','products','inventory','customers','quotes',
    'reports','reports_basic','users','settings','notifications','audit'
  ];
  pro_extra_codes TEXT[] := ARRAY[
    'crm','financial','pix','service_orders','ocr','excel_import','reports_advanced'
  ];
  pro_codes TEXT[] := starter_codes || pro_extra_codes;
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
END $$;
