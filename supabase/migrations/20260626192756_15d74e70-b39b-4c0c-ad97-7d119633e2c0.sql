-- Prevent company owners from escalating any user to super_admin
DROP POLICY IF EXISTS user_roles_manage_admin ON public.user_roles;

CREATE POLICY user_roles_manage_super ON public.user_roles
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY user_roles_manage_owner ON public.user_roles
  FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND has_company_role('owner'::app_role)
    AND role <> 'super_admin'::app_role
  )
  WITH CHECK (
    company_id = current_company_id()
    AND has_company_role('owner'::app_role)
    AND role <> 'super_admin'::app_role
  );