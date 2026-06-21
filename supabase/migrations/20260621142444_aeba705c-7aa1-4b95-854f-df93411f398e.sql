-- Phase 4: Foundation consolidation
-- Rename settings → company_settings to match spec
ALTER TABLE public.settings RENAME TO company_settings;

-- Additional indexes for performance & spec compliance
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_plan ON public.companies(plan_id);
CREATE INDEX IF NOT EXISTS idx_companies_created ON public.companies(created_at);
CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies(email);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON public.subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_company ON public.attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_attachments_module ON public.attachments(module);
CREATE INDEX IF NOT EXISTS idx_user_invitations_company ON public.user_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON public.user_invitations(status);

-- Helpful documentation comments
COMMENT ON TABLE public.companies IS 'Empresas (tenants) — raiz do isolamento multiempresa.';
COMMENT ON TABLE public.profiles IS 'Perfis de usuário vinculados a auth.users e a uma empresa (company_id).';
COMMENT ON TABLE public.plans IS 'Planos da plataforma SaaS (Starter, Pro, Business).';
COMMENT ON TABLE public.subscriptions IS 'Assinaturas por empresa, vinculadas a um plano.';
COMMENT ON TABLE public.company_settings IS 'Configurações por empresa (timezone, idioma, moeda, tema).';
COMMENT ON TABLE public.notifications IS 'Notificações em tempo real por usuário/empresa.';
COMMENT ON TABLE public.activity_logs IS 'Log resumido de atividades dos usuários por empresa.';
COMMENT ON TABLE public.audit_logs IS 'Auditoria detalhada (before/after JSONB) por módulo.';
COMMENT ON TABLE public.attachments IS 'Anexos genéricos vinculados por (módulo, record_id).';

-- Re-seed/refresh plans pricing (idempotent)
INSERT INTO public.plans (name, slug, monthly_price, annual_price, max_users, max_storage_gb, active)
VALUES
  ('Starter',  'starter',  99.00,   990.00,  3,  5,  true),
  ('Pro',      'pro',      249.00,  2490.00, 10, 25, true),
  ('Business', 'business', 599.00,  5990.00, 50, 100, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  max_users = EXCLUDED.max_users,
  max_storage_gb = EXCLUDED.max_storage_gb,
  active = EXCLUDED.active;