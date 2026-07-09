
-- =========================================================
-- 1) ROLES: restringir leitura aos papéis do próprio usuário
-- =========================================================
DROP POLICY IF EXISTS "roles_read_all" ON public.roles;

CREATE POLICY "roles_read_super_admin"
  ON public.roles FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "roles_read_own"
  ON public.roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_roles pr
       WHERE pr.role_id = roles.id
         AND pr.profile_id = auth.uid()
    )
  );

-- =========================================================
-- 2) PERMISSIONS: leitura só das permissões dos papéis do usuário
-- =========================================================
DROP POLICY IF EXISTS "perm_read_all" ON public.permissions;

CREATE POLICY "perm_read_super_admin"
  ON public.permissions FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "perm_read_own_roles"
  ON public.permissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.role_permissions rp
        JOIN public.profile_roles pr ON pr.role_id = rp.role_id
       WHERE rp.permission_id = permissions.id
         AND pr.profile_id = auth.uid()
    )
  );

-- =========================================================
-- 3) ROLE_PERMISSIONS: mapeamentos apenas dos papéis do usuário
-- =========================================================
DROP POLICY IF EXISTS "rp_read_all" ON public.role_permissions;

CREATE POLICY "rp_read_super_admin"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "rp_read_own_roles"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_roles pr
       WHERE pr.role_id = role_permissions.role_id
         AND pr.profile_id = auth.uid()
    )
  );

-- =========================================================
-- 4) BILLING_PROVIDER_SETTINGS: remove leitura direta e cria view segura
-- =========================================================
DROP POLICY IF EXISTS "ps authenticated read public config" ON public.billing_provider_settings;

CREATE OR REPLACE VIEW public.billing_provider_settings_public
WITH (security_invoker = true) AS
  SELECT
    id,
    provider,
    environment,
    active,
    terms_of_use_url,
    privacy_policy_url,
    support_whatsapp,
    support_email
  FROM public.billing_provider_settings
  WHERE active = true;

-- A view SECURITY INVOKER exige uma política que permita a leitura das colunas seguras.
CREATE POLICY "ps read safe columns via view"
  ON public.billing_provider_settings FOR SELECT TO authenticated
  USING (active = true);

REVOKE ALL ON public.billing_provider_settings_public FROM PUBLIC;
GRANT SELECT ON public.billing_provider_settings_public TO authenticated;
GRANT ALL  ON public.billing_provider_settings_public TO service_role;
