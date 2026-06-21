
-- =========================================================================
-- RBAC Expansion: profile_roles + granular permissions + helpers
-- =========================================================================

-- 1) profile_roles (M:N between profiles and roles table)
CREATE TABLE IF NOT EXISTS public.profile_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, role_id)
);

GRANT SELECT ON public.profile_roles TO authenticated;
GRANT ALL ON public.profile_roles TO service_role;
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_roles_select_own_company" ON public.profile_roles
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR company_id = public.current_company_id()
    OR public.is_super_admin()
  );

CREATE POLICY "profile_roles_manage_owner" ON public.profile_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.has_company_role('owner'))
  WITH CHECK (public.is_super_admin() OR public.has_company_role('owner'));

CREATE INDEX idx_profile_roles_profile ON public.profile_roles(profile_id);
CREATE INDEX idx_profile_roles_role ON public.profile_roles(role_id);
CREATE INDEX idx_profile_roles_company ON public.profile_roles(company_id);

-- 2) Expand permissions to granular view/create/edit/delete per module
-- Add new granular permissions (keep legacy ones for backwards compatibility)
INSERT INTO public.permissions (slug, module, action, description) VALUES
  -- dashboard
  ('dashboard.view','dashboard','view','Visualizar Dashboard'),
  -- products
  ('products.create','products','create','Criar produtos'),
  ('products.edit','products','edit','Editar produtos'),
  ('products.delete','products','delete','Excluir produtos'),
  -- clients
  ('clients.create','clients','create','Criar clientes'),
  ('clients.edit','clients','edit','Editar clientes'),
  ('clients.delete','clients','delete','Excluir clientes'),
  -- stock
  ('stock.create','stock','create','Criar movimentações de estoque'),
  ('stock.edit','stock','edit','Editar movimentações de estoque'),
  ('stock.delete','stock','delete','Excluir movimentações de estoque'),
  -- quotes
  ('quotes.create','quotes','create','Criar orçamentos'),
  ('quotes.edit','quotes','edit','Editar orçamentos'),
  ('quotes.delete','quotes','delete','Excluir orçamentos'),
  -- financial
  ('financial.create','financial','create','Criar lançamentos financeiros'),
  ('financial.edit','financial','edit','Editar lançamentos financeiros'),
  ('financial.delete','financial','delete','Excluir lançamentos financeiros'),
  -- crm
  ('crm.create','crm','create','Criar registros CRM'),
  ('crm.edit','crm','edit','Editar registros CRM'),
  ('crm.delete','crm','delete','Excluir registros CRM'),
  -- service orders
  ('orders.create','orders','create','Criar ordens de serviço'),
  ('orders.edit','orders','edit','Editar ordens de serviço'),
  ('orders.delete','orders','delete','Excluir ordens de serviço'),
  -- reports
  ('reports.create','reports','create','Gerar relatórios'),
  ('reports.edit','reports','edit','Editar relatórios'),
  ('reports.delete','reports','delete','Excluir relatórios'),
  -- settings
  ('settings.create','settings','create','Criar itens em configurações'),
  ('settings.edit','settings','edit','Editar configurações'),
  ('settings.delete','settings','delete','Excluir configurações')
ON CONFLICT (slug) DO NOTHING;

-- 3) Seed role_permissions for granular set
-- OWNER: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug='owner'
ON CONFLICT DO NOTHING;

-- MANAGER: everything except settings.delete and settings.create/edit (only view)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='manager'
  AND p.slug NOT IN ('settings.create','settings.edit','settings.delete')
ON CONFLICT DO NOTHING;

-- FINANCIAL: financial + reports + dashboard view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='financial'
  AND (p.module IN ('financial','reports') OR p.slug='dashboard.view')
ON CONFLICT DO NOTHING;

-- COMMERCIAL: clients + crm + quotes + dashboard view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='commercial'
  AND (p.module IN ('clients','crm','quotes') OR p.slug='dashboard.view')
ON CONFLICT DO NOTHING;

-- STOCK: products + stock + dashboard view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='stock'
  AND (p.module IN ('products','stock') OR p.slug='dashboard.view')
ON CONFLICT DO NOTHING;

-- TECHNICIAN: service orders + dashboard view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug='technician'
  AND (p.module='orders' OR p.slug='dashboard.view' OR p.slug='clients.view')
ON CONFLICT DO NOTHING;

-- 4) Backfill profile_roles from existing user_roles (enum -> roles.slug)
INSERT INTO public.profile_roles (profile_id, role_id, company_id)
SELECT ur.user_id, r.id, ur.company_id
FROM public.user_roles ur
JOIN public.roles r ON r.slug = ur.role::text
ON CONFLICT DO NOTHING;

-- 5) Trigger to keep profile_roles in sync when user_roles changes
CREATE OR REPLACE FUNCTION public.sync_user_role_to_profile_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rid UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO rid FROM public.roles WHERE slug = NEW.role::text;
    IF rid IS NOT NULL THEN
      INSERT INTO public.profile_roles (profile_id, role_id, company_id)
        VALUES (NEW.user_id, rid, NEW.company_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO rid FROM public.roles WHERE slug = OLD.role::text;
    IF rid IS NOT NULL THEN
      DELETE FROM public.profile_roles
        WHERE profile_id = OLD.user_id AND role_id = rid;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_user_roles ON public.user_roles;
CREATE TRIGGER trg_sync_user_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_profile_roles();

-- 6) get_my_permissions(): canonical permission resolver (super_admin & owner = all)
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TEXT[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  perms TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  IF public.is_super_admin() OR public.has_company_role('owner') THEN
    SELECT array_agg(slug) INTO perms FROM public.permissions;
    RETURN COALESCE(perms, ARRAY[]::TEXT[]);
  END IF;

  SELECT array_agg(DISTINCT p.slug) INTO perms
  FROM public.profile_roles pr
  JOIN public.role_permissions rp ON rp.role_id = pr.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE pr.profile_id = auth.uid();

  RETURN COALESCE(perms, ARRAY[]::TEXT[]);
END; $$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- 7) has_permission(slug) helper for RLS policies
CREATE OR REPLACE FUNCTION public.has_permission(_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() OR public.has_company_role('owner') THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE pr.profile_id = auth.uid() AND p.slug = _slug
  );
END; $$;

REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;
