
-- 1) billing_provider_settings: remove authenticated SELECT (view exposes safe columns)
DROP POLICY IF EXISTS "ps read safe columns via view" ON public.billing_provider_settings;
-- Ensure view is accessible to authenticated for safe columns
GRANT SELECT ON public.billing_provider_settings_public TO authenticated, anon;

-- 2) notifications: restrict INSERT to self-targeted or super_admin
DROP POLICY IF EXISTS notif_insert_company ON public.notifications;
CREATE POLICY notif_insert_self ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = current_company_id()
    AND (
      is_super_admin()
      OR user_id = auth.uid()
    )
  );

-- 3) user_roles: prevent owners from granting owner or super_admin role
DROP POLICY IF EXISTS user_roles_manage_owner ON public.user_roles;
CREATE POLICY user_roles_manage_owner ON public.user_roles
  FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND has_company_role('owner'::app_role)
    AND role NOT IN ('super_admin'::app_role, 'owner'::app_role)
  )
  WITH CHECK (
    company_id = current_company_id()
    AND has_company_role('owner'::app_role)
    AND role NOT IN ('super_admin'::app_role, 'owner'::app_role)
  );
