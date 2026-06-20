
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('super_admin','owner','manager','financial','commercial','stock','technician');
CREATE TYPE public.company_status AS ENUM ('active','inactive','trial','blocked');
CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','expired','revoked');

-- ============= UPDATED_AT TRIGGER =============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============= PLANS =============
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  annual_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_users INT NOT NULL DEFAULT 1,
  max_storage_gb INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT USING (active = true);
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plans (name, slug, monthly_price, annual_price, max_users, max_storage_gb) VALUES
  ('Starter','starter',49.00,490.00,3,5),
  ('Pro','pro',149.00,1490.00,10,25),
  ('Business','business',399.00,3990.00,50,100);

-- ============= COMPANIES =============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  logo_url TEXT,
  status public.company_status NOT NULL DEFAULT 'trial',
  plan_id UUID REFERENCES public.plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= USER_ROLES (separate from profiles - security) =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============= SECURITY DEFINER HELPERS =============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = _role
      AND ur.company_id = p.company_id
  )
$$;

-- ============= COMPANIES RLS =============
CREATE POLICY "companies_select_own_or_admin" ON public.companies FOR SELECT
  USING (id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "companies_update_owner_or_admin" ON public.companies FOR UPDATE
  USING ((id = public.current_company_id() AND public.has_company_role('owner')) OR public.is_super_admin());
CREATE POLICY "companies_insert_admin" ON public.companies FOR INSERT
  WITH CHECK (public.is_super_admin());
CREATE POLICY "companies_delete_admin" ON public.companies FOR DELETE
  USING (public.is_super_admin());

-- ============= PROFILES RLS =============
CREATE POLICY "profiles_select_same_company" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- ============= USER_ROLES RLS =============
CREATE POLICY "user_roles_select_own_company" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "user_roles_manage_admin" ON public.user_roles FOR ALL
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')))
  WITH CHECK (public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')));

-- ============= AUTO CREATE PROFILE ON SIGNUP =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= SUBSCRIPTIONS =============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiration_date TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  trial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_select_own" ON public.subscriptions FOR SELECT
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "sub_manage_admin" ON public.subscriptions FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_sub_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ROLES (definition) =============
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_all" ON public.roles FOR SELECT TO authenticated USING (true);

INSERT INTO public.roles (slug, name, description) VALUES
  ('super_admin','Super Admin','Administrador da plataforma'),
  ('owner','Proprietário','Dono da empresa, acesso total'),
  ('manager','Gerente','Gestão operacional'),
  ('financial','Financeiro','Módulos financeiros'),
  ('commercial','Comercial','Vendas, CRM e orçamentos'),
  ('stock','Estoquista','Estoque e produtos'),
  ('technician','Técnico','Ordens de serviço');

-- ============= PERMISSIONS =============
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm_read_all" ON public.permissions FOR SELECT TO authenticated USING (true);

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('products.view','products','view','Visualizar produtos'),
  ('products.manage','products','manage','Gerenciar produtos'),
  ('stock.view','stock','view','Visualizar estoque'),
  ('stock.manage','stock','manage','Gerenciar estoque'),
  ('clients.view','clients','view','Visualizar clientes'),
  ('clients.manage','clients','manage','Gerenciar clientes'),
  ('quotes.view','quotes','view','Visualizar orçamentos'),
  ('quotes.manage','quotes','manage','Gerenciar orçamentos'),
  ('financial.view','financial','view','Visualizar financeiro'),
  ('financial.manage','financial','manage','Gerenciar financeiro'),
  ('crm.view','crm','view','Visualizar CRM'),
  ('crm.manage','crm','manage','Gerenciar CRM'),
  ('orders.view','orders','view','Visualizar ordens de serviço'),
  ('orders.manage','orders','manage','Gerenciar ordens de serviço'),
  ('reports.view','reports','view','Visualizar relatórios'),
  ('settings.view','settings','view','Visualizar configurações'),
  ('settings.manage','settings','manage','Gerenciar configurações'),
  ('users.manage','users','manage','Gerenciar usuários');

-- ============= ROLE_PERMISSIONS =============
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp_read_all" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_manage_admin" ON public.role_permissions FOR ALL
  USING (public.is_super_admin() OR public.has_company_role('owner'))
  WITH CHECK (public.is_super_admin() OR public.has_company_role('owner'));

-- Seed default role-permission mapping
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug IN ('super_admin','owner');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='manager' AND p.slug IN ('products.view','stock.view','clients.view','clients.manage','quotes.view','quotes.manage','financial.view','crm.view','crm.manage','orders.view','orders.manage','reports.view','settings.view');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='financial' AND p.slug IN ('financial.view','financial.manage','reports.view','clients.view','quotes.view');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='commercial' AND p.slug IN ('clients.view','clients.manage','quotes.view','quotes.manage','crm.view','crm.manage','products.view');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='stock' AND p.slug IN ('products.view','products.manage','stock.view','stock.manage');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='technician' AND p.slug IN ('orders.view','orders.manage','clients.view');

-- ============= USER_INVITATIONS =============
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'commercial',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invitations TO authenticated;
GRANT ALL ON public.user_invitations TO service_role;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select_company" ON public.user_invitations FOR SELECT
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "inv_manage_owner" ON public.user_invitations FOR ALL
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')))
  WITH CHECK (public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')));

-- ============= NOTIFICATIONS =============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT
  USING ((user_id = auth.uid() OR user_id IS NULL) AND company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "notif_insert_company" ON public.notifications FOR INSERT
  WITH CHECK (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE
  USING (user_id = auth.uid() OR public.is_super_admin());

-- ============= SETTINGS =============
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  dark_mode BOOLEAN NOT NULL DEFAULT true,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_company" ON public.settings FOR SELECT
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "settings_manage_owner" ON public.settings FOR ALL
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')))
  WITH CHECK (public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= AUDIT LOGS =============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_owner_or_admin" ON public.audit_logs FOR SELECT
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.has_company_role('owner')));
CREATE POLICY "audit_insert_company" ON public.audit_logs FOR INSERT
  WITH CHECK (company_id = public.current_company_id() OR public.is_super_admin());

-- ============= ATTACHMENTS =============
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  record_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_select_company" ON public.attachments FOR SELECT
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "att_manage_company" ON public.attachments FOR ALL
  USING (company_id = public.current_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.current_company_id() OR public.is_super_admin());

-- ============= ACTIVITY LOGS =============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_select_company" ON public.activity_logs FOR SELECT
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "act_insert_company" ON public.activity_logs FOR INSERT
  WITH CHECK (company_id = public.current_company_id());

-- ============= INDEXES =============
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company ON public.user_roles(company_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);
CREATE INDEX idx_audit_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX idx_activity_company ON public.activity_logs(company_id, created_at DESC);
CREATE INDEX idx_attachments_record ON public.attachments(module, record_id);
