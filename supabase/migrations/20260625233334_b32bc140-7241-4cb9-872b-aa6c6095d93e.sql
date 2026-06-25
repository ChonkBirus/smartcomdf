
-- ============ billing_provider_settings: colunas de termos/suporte ============
ALTER TABLE public.billing_provider_settings
  ADD COLUMN IF NOT EXISTS terms_of_use_url TEXT,
  ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT,
  ADD COLUMN IF NOT EXISTS support_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS support_email TEXT;

-- ============ billing_dunning_rules ============
CREATE TABLE public.billing_dunning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'TRIAL_ENDING','TRIAL_EXPIRED','PAYMENT_DUE','PAYMENT_OVERDUE',
    'SUBSCRIPTION_SUSPENDED','CANCELLATION_REQUESTED','CANCELLATION_DUE_SOON','REACTIVATED'
  )),
  trigger_offset_days INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_dunning_rules TO authenticated;
GRANT ALL ON public.billing_dunning_rules TO service_role;
ALTER TABLE public.billing_dunning_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dunning_rules super admin all" ON public.billing_dunning_rules
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_dunning_rules_updated BEFORE UPDATE ON public.billing_dunning_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ billing_dunning_events ============
CREATE TABLE public.billing_dunning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  billing_charge_id UUID REFERENCES public.billing_charges(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.billing_dunning_rules(id) ON DELETE SET NULL,
  event_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','HANDLED','SKIPPED','CANCELED','FAILED')),
  due_date DATE,
  scheduled_for TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  channel TEXT CHECK (channel IN ('INTERNAL','WHATSAPP_MANUAL','EMAIL_MANUAL','SYSTEM')),
  message TEXT,
  handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_dunning_events_dedup
  ON public.billing_dunning_events (
    company_id, subscription_id, event_code,
    COALESCE(billing_charge_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(due_date, '1900-01-01'::date)
  );
CREATE INDEX ix_dunning_events_company ON public.billing_dunning_events(company_id);
CREATE INDEX ix_dunning_events_status ON public.billing_dunning_events(status);
CREATE INDEX ix_dunning_events_code ON public.billing_dunning_events(event_code);
GRANT SELECT, INSERT, UPDATE ON public.billing_dunning_events TO authenticated;
GRANT ALL ON public.billing_dunning_events TO service_role;
ALTER TABLE public.billing_dunning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dunning_events super admin all" ON public.billing_dunning_events
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_dunning_events_updated BEFORE UPDATE ON public.billing_dunning_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ commercial_contact_logs ============
CREATE TABLE public.commercial_contact_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  contact_type TEXT NOT NULL CHECK (contact_type IN (
    'TRIAL_FOLLOW_UP','PAYMENT_REMINDER','OVERDUE_COLLECTION',
    'CANCELLATION_RECOVERY','UPGRADE_SALE','SUPPORT','OTHER'
  )),
  contact_channel TEXT NOT NULL CHECK (contact_channel IN ('WHATSAPP','PHONE','EMAIL','MANUAL','INTERNAL')),
  subject TEXT,
  message TEXT,
  result TEXT,
  contacted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_contact_logs_company ON public.commercial_contact_logs(company_id);
CREATE INDEX ix_contact_logs_followup ON public.commercial_contact_logs(next_follow_up_at);
GRANT SELECT, INSERT, UPDATE ON public.commercial_contact_logs TO authenticated;
GRANT ALL ON public.commercial_contact_logs TO service_role;
ALTER TABLE public.commercial_contact_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_logs super admin all" ON public.commercial_contact_logs
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_contact_logs_updated BEFORE UPDATE ON public.commercial_contact_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ commercial_launch_checklist ============
CREATE TABLE public.commercial_launch_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.commercial_launch_checklist TO authenticated;
GRANT ALL ON public.commercial_launch_checklist TO service_role;
ALTER TABLE public.commercial_launch_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "launch_checklist super admin all" ON public.commercial_launch_checklist
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_launch_checklist_updated BEFORE UPDATE ON public.commercial_launch_checklist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ commercial_pilots ============
CREATE TABLE public.commercial_pilots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE_TRIAL' CHECK (status IN (
    'ACTIVE_TRIAL','IN_CONTACT','READY_TO_CONVERT','CONVERTED','LOST'
  )),
  source TEXT,
  responsible_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  expected_conversion_date DATE,
  converted_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  loss_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);
CREATE INDEX ix_pilots_status ON public.commercial_pilots(status);
GRANT SELECT, INSERT, UPDATE ON public.commercial_pilots TO authenticated;
GRANT ALL ON public.commercial_pilots TO service_role;
ALTER TABLE public.commercial_pilots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilots super admin all" ON public.commercial_pilots
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_pilots_updated BEFORE UPDATE ON public.commercial_pilots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEEDS — régua de cobrança ============
INSERT INTO public.billing_dunning_rules (code, name, description, trigger_type, trigger_offset_days, sort_order) VALUES
  ('TRIAL_D3','Trial vencendo em 3 dias','Aviso antecipado de fim de trial.','TRIAL_ENDING',3,10),
  ('TRIAL_D1','Trial vencendo em 1 dia','Último aviso antes do fim do trial.','TRIAL_ENDING',1,20),
  ('TRIAL_EXPIRED','Trial expirado','Trial terminou sem conversão.','TRIAL_EXPIRED',0,30),
  ('PAYMENT_DUE_TODAY','Cobrança vence hoje','Lembrete de vencimento no dia.','PAYMENT_DUE',0,40),
  ('PAYMENT_OVERDUE_D1','Pagamento atrasado 1 dia','Primeiro lembrete de atraso.','PAYMENT_OVERDUE',1,50),
  ('PAYMENT_OVERDUE_D3','Pagamento atrasado 3 dias','Segundo lembrete de atraso.','PAYMENT_OVERDUE',3,60),
  ('PAYMENT_OVERDUE_D5','Pagamento atrasado 5 dias','Aviso final antes da suspensão.','PAYMENT_OVERDUE',5,70),
  ('SUBSCRIPTION_SUSPENDED','Assinatura suspensa','Assinatura suspensa por inadimplência.','SUBSCRIPTION_SUSPENDED',0,80)
ON CONFLICT (code) DO NOTHING;

-- ============ SEEDS — checklist de lançamento ============
INSERT INTO public.commercial_launch_checklist (key, title, sort_order) VALUES
  ('plans_configured','Planos configurados',10),
  ('checkout_working','Checkout funcionando',20),
  ('webhook_working','Webhook funcionando',30),
  ('pix_tested','Pix testado',40),
  ('boleto_tested','Boleto testado',50),
  ('card_tested','Cartão/checkout seguro testado',60),
  ('subscription_guard','SubscriptionGuard funcionando',70),
  ('invoices_screen','Tela de faturas funcionando',80),
  ('dunning_configured','Régua de cobrança configurada',90),
  ('admin_panel','Painel admin funcionando',100),
  ('terms_of_use','Termos de uso cadastrados',110),
  ('privacy_policy','Política de privacidade cadastrada',120),
  ('support_whatsapp','Suporte/WhatsApp configurado',130),
  ('public_sales_page','Página pública de vendas configurada',140),
  ('first_pilot','Primeiro cliente piloto cadastrado',150),
  ('first_payment','Primeiro pagamento confirmado',160)
ON CONFLICT (key) DO NOTHING;
