
-- ============================================================
-- FASE 2.7A — Etapa A: Base de Assinaturas SaaS
-- ============================================================

-- 1) Extender plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE public.plans SET description = 'Para começar a organizar sua operação.', sort_order = 1 WHERE slug = 'starter';
UPDATE public.plans SET description = 'Para empresas que fazem instalação, manutenção e atendimento técnico.', sort_order = 2 WHERE slug = 'pro';
UPDATE public.plans SET description = 'Para empresas com operação avançada, equipe maior e integrações.', sort_order = 3 WHERE slug = 'business';

-- 2) plan_limits
CREATE TABLE IF NOT EXISTS public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL UNIQUE REFERENCES public.plans(id) ON DELETE CASCADE,
  max_users INTEGER,
  max_companies INTEGER,
  storage_gb INTEGER,
  monthly_ocr_limit INTEGER,
  monthly_import_limit INTEGER,
  monthly_service_order_limit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_limits TO authenticated, anon;
GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits_public_read" ON public.plan_limits FOR SELECT USING (true);
CREATE POLICY "plan_limits_admin_manage" ON public.plan_limits FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_plan_limits_updated BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Estender subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'TRIALING',
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS yearly_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS current_period_start DATE,
  ADD COLUMN IF NOT EXISTS current_period_end DATE,
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_date DATE,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_chk') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_chk
      CHECK (status IN ('TRIALING','ACTIVE','PAST_DUE','SUSPENDED','CANCELED','EXPIRED','MANUAL_REVIEW'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_cycle_chk') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_cycle_chk
      CHECK (billing_cycle IN ('MONTHLY','YEARLY'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends ON public.subscriptions(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- 4) subscription_events
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  previous_plan_id UUID REFERENCES public.plans(id),
  new_plan_id UUID REFERENCES public.plans(id),
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_events_type_chk CHECK (event_type IN (
    'TRIAL_STARTED','TRIAL_EXPIRED','SUBSCRIPTION_ACTIVATED','PAYMENT_PENDING',
    'PAYMENT_CONFIRMED','SUBSCRIPTION_SUSPENDED','SUBSCRIPTION_REACTIVATED',
    'SUBSCRIPTION_CANCELED','PLAN_CHANGED','BILLING_CYCLE_CHANGED','MANUAL_ADJUSTMENT'
  ))
);

CREATE INDEX IF NOT EXISTS idx_sub_events_company ON public.subscription_events(company_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_sub ON public.subscription_events(subscription_id);

GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_events_select_own" ON public.subscription_events FOR SELECT
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "sub_events_admin_manage" ON public.subscription_events FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 5) subscription_usage
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  users_count INTEGER NOT NULL DEFAULT 0,
  storage_used_mb INTEGER NOT NULL DEFAULT 0,
  ocr_used_count INTEGER NOT NULL DEFAULT 0,
  imports_used_count INTEGER NOT NULL DEFAULT 0,
  service_orders_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_start)
);

GRANT SELECT ON public.subscription_usage TO authenticated;
GRANT ALL ON public.subscription_usage TO service_role;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_usage_select_own" ON public.subscription_usage FOR SELECT
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "sub_usage_admin_manage" ON public.subscription_usage FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_sub_usage_updated BEFORE UPDATE ON public.subscription_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Permissões
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('billing.view', 'billing', 'view', 'Ver assinatura da empresa'),
  ('billing.manage', 'billing', 'manage', 'Gerenciar assinatura da empresa'),
  ('billing.change_plan', 'billing', 'change_plan', 'Solicitar alteração de plano'),
  ('billing.view_usage', 'billing', 'view_usage', 'Ver uso e limites do plano'),
  ('saas_admin.subscriptions.view', 'saas_admin', 'subscriptions_view', 'Admin SaaS: ver todas as assinaturas'),
  ('saas_admin.subscriptions.manage', 'saas_admin', 'subscriptions_manage', 'Admin SaaS: gerenciar assinaturas'),
  ('saas_admin.companies.view', 'saas_admin', 'companies_view', 'Admin SaaS: ver todas as empresas')
ON CONFLICT (slug) DO NOTHING;

-- 7) Seeds plan_limits
INSERT INTO public.plan_limits (plan_id, max_users, max_companies, storage_gb, monthly_ocr_limit, monthly_import_limit, monthly_service_order_limit)
SELECT id, 3, 1, 5, 0, 10, 0 FROM public.plans WHERE slug = 'starter'
ON CONFLICT (plan_id) DO UPDATE SET max_users=3, max_companies=1, storage_gb=5, monthly_ocr_limit=0, monthly_import_limit=10, monthly_service_order_limit=0;

INSERT INTO public.plan_limits (plan_id, max_users, max_companies, storage_gb, monthly_ocr_limit, monthly_import_limit, monthly_service_order_limit)
SELECT id, 10, 1, 20, 100, 100, NULL FROM public.plans WHERE slug = 'pro'
ON CONFLICT (plan_id) DO UPDATE SET max_users=10, max_companies=1, storage_gb=20, monthly_ocr_limit=100, monthly_import_limit=100, monthly_service_order_limit=NULL;

INSERT INTO public.plan_limits (plan_id, max_users, max_companies, storage_gb, monthly_ocr_limit, monthly_import_limit, monthly_service_order_limit)
SELECT id, NULL, NULL, 100, 500, 500, NULL FROM public.plans WHERE slug = 'business'
ON CONFLICT (plan_id) DO UPDATE SET max_users=NULL, max_companies=NULL, storage_gb=100, monthly_ocr_limit=500, monthly_import_limit=500, monthly_service_order_limit=NULL;

-- Backfill prices em subscriptions existentes a partir do plano
UPDATE public.subscriptions s
SET monthly_price = COALESCE(s.monthly_price, p.monthly_price),
    yearly_price = COALESCE(s.yearly_price, p.annual_price)
FROM public.plans p WHERE p.id = s.plan_id AND (s.monthly_price IS NULL OR s.yearly_price IS NULL);

-- 8) Trigger: nova empresa -> subscription TRIALING em Pro por 7 dias
CREATE OR REPLACE FUNCTION public.create_default_subscription_for_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_sub_id UUID;
  v_trial_end TIMESTAMPTZ := now() + INTERVAL '7 days';
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE company_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE slug = 'pro' LIMIT 1;
  IF v_plan.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.subscriptions (
    company_id, plan_id, status, billing_cycle, monthly_price, yearly_price,
    start_date, current_period_start, current_period_end,
    trial_starts_at, trial_ends_at, active, trial
  ) VALUES (
    NEW.id, v_plan.id, 'TRIALING', 'MONTHLY', v_plan.monthly_price, v_plan.annual_price,
    now(), CURRENT_DATE, v_trial_end::date,
    now(), v_trial_end, true, true
  ) RETURNING id INTO v_sub_id;

  INSERT INTO public.subscription_events (company_id, subscription_id, event_type, new_status, new_plan_id, description)
  VALUES (NEW.id, v_sub_id, 'TRIAL_STARTED', 'TRIALING', v_plan.id, 'Trial de 7 dias iniciado automaticamente no plano Pro');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_company_default_subscription ON public.companies;
CREATE TRIGGER trg_company_default_subscription
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription_for_company();

-- 9) Função de expiração (sem cron nesta fase)
CREATE OR REPLACE FUNCTION public.expire_trials_and_subscriptions(p_grace_days INTEGER DEFAULT 5)
RETURNS TABLE (action TEXT, subscription_id UUID, company_id UUID, new_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  -- TRIALING vencido -> EXPIRED
  FOR r IN
    SELECT id, company_id FROM public.subscriptions
    WHERE status = 'TRIALING' AND trial_ends_at IS NOT NULL AND trial_ends_at < now()
  LOOP
    UPDATE public.subscriptions SET status='EXPIRED', active=false WHERE id = r.id;
    INSERT INTO public.subscription_events (company_id, subscription_id, event_type, previous_status, new_status, description)
    VALUES (r.company_id, r.id, 'TRIAL_EXPIRED', 'TRIALING', 'EXPIRED', 'Trial expirado automaticamente');
    action := 'TRIAL_EXPIRED'; subscription_id := r.id; company_id := r.company_id; new_status := 'EXPIRED';
    RETURN NEXT;
  END LOOP;

  -- ACTIVE com next_billing_date vencido -> PAST_DUE (define tolerância)
  FOR r IN
    SELECT id, company_id FROM public.subscriptions
    WHERE status = 'ACTIVE' AND next_billing_date IS NOT NULL AND next_billing_date < CURRENT_DATE
  LOOP
    UPDATE public.subscriptions SET status='PAST_DUE', grace_period_ends_at = now() + (p_grace_days || ' days')::interval
    WHERE id = r.id;
    INSERT INTO public.subscription_events (company_id, subscription_id, event_type, previous_status, new_status, description)
    VALUES (r.company_id, r.id, 'PAYMENT_PENDING', 'ACTIVE', 'PAST_DUE', 'Pagamento em atraso; iniciado período de tolerância');
    action := 'PAYMENT_PENDING'; subscription_id := r.id; company_id := r.company_id; new_status := 'PAST_DUE';
    RETURN NEXT;
  END LOOP;

  -- PAST_DUE com tolerância vencida -> SUSPENDED
  FOR r IN
    SELECT id, company_id FROM public.subscriptions
    WHERE status = 'PAST_DUE' AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at < now()
  LOOP
    UPDATE public.subscriptions SET status='SUSPENDED', suspended_at=now(), active=false WHERE id = r.id;
    INSERT INTO public.subscription_events (company_id, subscription_id, event_type, previous_status, new_status, description)
    VALUES (r.company_id, r.id, 'SUBSCRIPTION_SUSPENDED', 'PAST_DUE', 'SUSPENDED', 'Suspensa após tolerância');
    action := 'SUBSCRIPTION_SUSPENDED'; subscription_id := r.id; company_id := r.company_id; new_status := 'SUSPENDED';
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.expire_trials_and_subscriptions(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_trials_and_subscriptions(INTEGER) TO service_role;
