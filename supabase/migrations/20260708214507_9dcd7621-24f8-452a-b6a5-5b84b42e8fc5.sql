
-- 1) Fix WITH CHECK on ALL policies so INSERTs require the same permission as USING

DROP POLICY IF EXISTS quote_items_all ON public.quote_items;
CREATE POLICY quote_items_all ON public.quote_items
  FOR ALL TO authenticated
  USING (
    (company_id = current_company_id())
    AND (is_super_admin() OR has_company_role('owner'::app_role)
         OR has_permission('quotes.view'::text) OR has_permission('quotes.manage'::text))
  )
  WITH CHECK (
    (company_id = current_company_id())
    AND (is_super_admin() OR has_company_role('owner'::app_role)
         OR has_permission('quotes.manage'::text))
  );

DROP POLICY IF EXISTS so_chk_items_modify ON public.service_order_checklist_items;
CREATE POLICY so_chk_items_modify ON public.service_order_checklist_items
  FOR ALL TO authenticated
  USING (
    (company_id = current_company_id())
    AND can_access_service_order(service_order_id)
    AND (has_permission('service_orders.manage_checklist'::text)
         OR has_permission('service_orders.execute'::text)
         OR has_company_role('owner'::app_role) OR is_super_admin())
  )
  WITH CHECK (
    (company_id = current_company_id())
    AND can_access_service_order(service_order_id)
    AND (has_permission('service_orders.manage_checklist'::text)
         OR has_permission('service_orders.execute'::text)
         OR has_company_role('owner'::app_role) OR is_super_admin())
  );

DROP POLICY IF EXISTS so_mat_usage_modify ON public.service_order_material_usage;
CREATE POLICY so_mat_usage_modify ON public.service_order_material_usage
  FOR ALL TO authenticated
  USING (
    (company_id = current_company_id())
    AND can_access_service_order(service_order_id)
    AND (has_permission('service_orders.manage_material_usage'::text)
         OR has_permission('service_orders.execute'::text)
         OR has_company_role('owner'::app_role) OR is_super_admin())
  )
  WITH CHECK (
    (company_id = current_company_id())
    AND can_access_service_order(service_order_id)
    AND (has_permission('service_orders.manage_material_usage'::text)
         OR has_permission('service_orders.execute'::text)
         OR has_company_role('owner'::app_role) OR is_super_admin())
  );

-- 2) Restrict {public}-role policies to {authenticated} explicitly

-- profiles
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((id = auth.uid()) OR is_super_admin());

DROP POLICY IF EXISTS profiles_select_same_company ON public.profiles;
CREATE POLICY profiles_select_same_company ON public.profiles
  FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR (company_id = current_company_id()) OR is_super_admin());

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR is_super_admin()
         OR ((company_id = current_company_id()) AND has_company_role('owner'::app_role)));

-- attachments
DROP POLICY IF EXISTS att_manage_company ON public.attachments;
CREATE POLICY att_manage_company ON public.attachments
  FOR ALL TO authenticated
  USING ((company_id = current_company_id()) OR is_super_admin())
  WITH CHECK ((company_id = current_company_id()) OR is_super_admin());

DROP POLICY IF EXISTS att_select_company ON public.attachments;
CREATE POLICY att_select_company ON public.attachments
  FOR SELECT TO authenticated
  USING ((company_id = current_company_id()) OR is_super_admin());

-- audit_logs
DROP POLICY IF EXISTS audit_insert_company ON public.audit_logs;
CREATE POLICY audit_insert_company ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) OR is_super_admin());

DROP POLICY IF EXISTS audit_select_owner_or_admin ON public.audit_logs;
CREATE POLICY audit_select_owner_or_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (is_super_admin()
         OR ((company_id = current_company_id()) AND has_company_role('owner'::app_role)));

-- notifications
DROP POLICY IF EXISTS notif_delete_own ON public.notifications;
CREATE POLICY notif_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR is_super_admin());

DROP POLICY IF EXISTS notif_select_own ON public.notifications;
CREATE POLICY notif_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING ((((user_id = auth.uid()) OR (user_id IS NULL))
          AND (company_id = current_company_id())) OR is_super_admin());

DROP POLICY IF EXISTS notif_update_own ON public.notifications;
CREATE POLICY notif_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) AND (company_id = current_company_id()));

-- companies
DROP POLICY IF EXISTS companies_delete_admin ON public.companies;
CREATE POLICY companies_delete_admin ON public.companies
  FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS companies_insert_admin ON public.companies;
CREATE POLICY companies_insert_admin ON public.companies
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS companies_select_own_or_admin ON public.companies;
CREATE POLICY companies_select_own_or_admin ON public.companies
  FOR SELECT TO authenticated
  USING ((id = current_company_id()) OR is_super_admin());

DROP POLICY IF EXISTS companies_update_owner_or_admin ON public.companies;
CREATE POLICY companies_update_owner_or_admin ON public.companies
  FOR UPDATE TO authenticated
  USING (((id = current_company_id()) AND has_company_role('owner'::app_role))
         OR is_super_admin());

-- company_settings
DROP POLICY IF EXISTS settings_manage_owner ON public.company_settings;
CREATE POLICY settings_manage_owner ON public.company_settings
  FOR ALL TO authenticated
  USING (is_super_admin()
         OR ((company_id = current_company_id()) AND has_company_role('owner'::app_role)))
  WITH CHECK (is_super_admin()
         OR ((company_id = current_company_id()) AND has_company_role('owner'::app_role)));

DROP POLICY IF EXISTS settings_select_company ON public.company_settings;
CREATE POLICY settings_select_company ON public.company_settings
  FOR SELECT TO authenticated
  USING ((company_id = current_company_id()) OR is_super_admin());

-- user_invitations
DROP POLICY IF EXISTS inv_manage_owner ON public.user_invitations;
CREATE POLICY inv_manage_owner ON public.user_invitations
  FOR ALL TO authenticated
  USING (is_super_admin()
         OR ((company_id = current_company_id()) AND has_company_role('owner'::app_role)))
  WITH CHECK (is_super_admin()
         OR ((company_id = current_company_id()) AND has_company_role('owner'::app_role)));

DROP POLICY IF EXISTS inv_select_company ON public.user_invitations;
CREATE POLICY inv_select_company ON public.user_invitations
  FOR SELECT TO authenticated
  USING ((company_id = current_company_id()) OR is_super_admin());

-- subscriptions
DROP POLICY IF EXISTS sub_manage_admin ON public.subscriptions;
CREATE POLICY sub_manage_admin ON public.subscriptions
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS sub_select_own ON public.subscriptions;
CREATE POLICY sub_select_own ON public.subscriptions
  FOR SELECT TO authenticated
  USING ((company_id = current_company_id()) OR is_super_admin());
