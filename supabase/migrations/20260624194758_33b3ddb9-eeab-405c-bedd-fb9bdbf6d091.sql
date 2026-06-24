
CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profile_roles WHERE profile_id = auth.uid() AND company_id = _company_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;

-- billing_customers
CREATE TABLE public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('ASAAS','MERCADO_PAGO','EFI','MANUAL')),
  provider_customer_id TEXT, name TEXT, email TEXT, cpf_cnpj TEXT, phone TEXT, mobile_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);
CREATE INDEX idx_billing_customers_company ON public.billing_customers(company_id);
CREATE INDEX idx_billing_customers_provider_id ON public.billing_customers(provider, provider_customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bc super admin all" ON public.billing_customers FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "bc company select" ON public.billing_customers FOR SELECT TO authenticated
  USING (public.is_company_member(company_id) AND public.has_permission('billing.view_charges'));
CREATE POLICY "bc company manage" ON public.billing_customers FOR ALL TO authenticated
  USING (public.is_company_member(company_id) AND public.has_permission('billing.checkout'))
  WITH CHECK (public.is_company_member(company_id) AND public.has_permission('billing.checkout'));

-- billing_checkout_sessions
CREATE TABLE public.billing_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  provider TEXT NOT NULL CHECK (provider IN ('ASAAS','MERCADO_PAGO','EFI','MANUAL')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY','YEARLY')),
  payment_method TEXT CHECK (payment_method IN ('PIX','CREDIT_CARD','BOLETO','UNDEFINED')),
  provider_checkout_id TEXT, checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PENDING','PAID','EXPIRED','CANCELED','FAILED')),
  amount NUMERIC(12,2) NOT NULL, expires_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cs_company ON public.billing_checkout_sessions(company_id);
CREATE INDEX idx_cs_subscription ON public.billing_checkout_sessions(subscription_id);
CREATE INDEX idx_cs_status ON public.billing_checkout_sessions(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_checkout_sessions TO authenticated;
GRANT ALL ON public.billing_checkout_sessions TO service_role;
ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs super admin all" ON public.billing_checkout_sessions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "cs company select" ON public.billing_checkout_sessions FOR SELECT TO authenticated
  USING (public.is_company_member(company_id) AND (public.has_permission('billing.view_charges') OR public.has_permission('billing.checkout')));
CREATE POLICY "cs company insert" ON public.billing_checkout_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id) AND public.has_permission('billing.checkout'));
CREATE POLICY "cs company update" ON public.billing_checkout_sessions FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id) AND public.has_permission('billing.checkout'))
  WITH CHECK (public.is_company_member(company_id) AND public.has_permission('billing.checkout'));

-- billing_charges
CREATE TABLE public.billing_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans(id),
  provider TEXT NOT NULL CHECK (provider IN ('ASAAS','MERCADO_PAGO','EFI','MANUAL')),
  provider_charge_id TEXT, provider_subscription_id TEXT,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY','YEARLY')),
  payment_method TEXT CHECK (payment_method IN ('PIX','CREDIT_CARD','BOLETO','UNDEFINED')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','WAITING_PAYMENT','PAID','CONFIRMED','OVERDUE','REFUNDED','CHARGEBACK','CANCELED','FAILED')),
  amount NUMERIC(12,2) NOT NULL, due_date DATE, paid_at TIMESTAMPTZ,
  invoice_url TEXT, bank_slip_url TEXT, pix_qr_code TEXT, pix_copy_paste TEXT, checkout_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bch_company ON public.billing_charges(company_id);
CREATE INDEX idx_bch_subscription ON public.billing_charges(subscription_id);
CREATE INDEX idx_bch_status ON public.billing_charges(status);
CREATE UNIQUE INDEX uniq_bch_provider_charge ON public.billing_charges(provider, provider_charge_id) WHERE provider_charge_id IS NOT NULL;
GRANT SELECT ON public.billing_charges TO authenticated;
GRANT ALL ON public.billing_charges TO service_role;
ALTER TABLE public.billing_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bch super admin all" ON public.billing_charges FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "bch company select" ON public.billing_charges FOR SELECT TO authenticated
  USING (public.is_company_member(company_id) AND public.has_permission('billing.view_charges'));

-- billing_webhook_events
CREATE TABLE public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('ASAAS','MERCADO_PAGO','EFI','MANUAL')),
  event_id TEXT, event_type TEXT NOT NULL, provider_object_id TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  processed_at TIMESTAMPTZ, error_message TEXT, payload_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_we_provider_event ON public.billing_webhook_events(provider, event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_we_provider_hash ON public.billing_webhook_events(provider, payload_hash) WHERE event_id IS NULL AND payload_hash IS NOT NULL;
CREATE INDEX idx_we_status ON public.billing_webhook_events(status);
CREATE INDEX idx_we_object ON public.billing_webhook_events(provider, provider_object_id);
GRANT SELECT ON public.billing_webhook_events TO authenticated;
GRANT ALL ON public.billing_webhook_events TO service_role;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "we super admin all" ON public.billing_webhook_events FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- billing_provider_settings
CREATE TABLE public.billing_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('ASAAS','MERCADO_PAGO','EFI','MANUAL')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox','production')),
  active BOOLEAN NOT NULL DEFAULT false,
  public_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, environment)
);
GRANT SELECT ON public.billing_provider_settings TO authenticated;
GRANT ALL ON public.billing_provider_settings TO service_role;
ALTER TABLE public.billing_provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps super admin all" ON public.billing_provider_settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "ps authenticated read active" ON public.billing_provider_settings FOR SELECT TO authenticated
  USING (active = true);

-- updated_at triggers (using existing set_updated_at function)
CREATE TRIGGER trg_bc_updated BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cs_updated BEFORE UPDATE ON public.billing_checkout_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bch_updated BEFORE UPDATE ON public.billing_charges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ps_updated BEFORE UPDATE ON public.billing_provider_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permissions
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('billing.checkout', 'billing', 'checkout', 'Iniciar checkout e contratar planos'),
  ('billing.view_charges', 'billing', 'view_charges', 'Visualizar faturas e cobranças'),
  ('billing.sync_status', 'billing', 'sync_status', 'Sincronizar status de cobrança no provedor'),
  ('billing.cancel_subscription', 'billing', 'cancel_subscription', 'Cancelar assinatura'),
  ('saas_admin.billing.view', 'saas_admin', 'billing_view', 'SaaS Admin: ver cobranças'),
  ('saas_admin.billing.manage', 'saas_admin', 'billing_manage', 'SaaS Admin: gerenciar cobranças'),
  ('saas_admin.webhooks.view', 'saas_admin', 'webhooks_view', 'SaaS Admin: ver webhooks'),
  ('saas_admin.webhooks.reprocess', 'saas_admin', 'webhooks_reprocess', 'SaaS Admin: reprocessar webhook')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug IN ('company_owner','company_admin','owner','admin','global_owner')
  AND p.slug IN ('billing.checkout','billing.view_charges','billing.sync_status','billing.cancel_subscription')
ON CONFLICT DO NOTHING;

INSERT INTO public.billing_provider_settings (provider, environment, active, public_config)
VALUES ('ASAAS','sandbox', true, '{"display_name":"Asaas","supports":["PIX","CREDIT_CARD","BOLETO"]}'::jsonb)
ON CONFLICT (provider, environment) DO NOTHING;
