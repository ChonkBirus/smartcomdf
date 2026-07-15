
-- 1) cnpj_lookup_cache: remove cross-tenant broad read; server uses service_role.
DROP POLICY IF EXISTS "cnpj cache authenticated read" ON public.cnpj_lookup_cache;
REVOKE SELECT ON public.cnpj_lookup_cache FROM authenticated;

-- 2) notifications: restrict SELECT to owner only; drop NULL user_id broadcast path.
DROP POLICY IF EXISTS notif_select_own ON public.notifications;
CREATE POLICY notif_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (
    ((user_id = auth.uid()) AND (company_id = current_company_id()))
    OR is_super_admin()
  );

-- 3) stock_locations: allow authorized deletion (has_permission stock.delete), scoped to company.
DROP POLICY IF EXISTS stock_locations_delete ON public.stock_locations;
CREATE POLICY stock_locations_delete ON public.stock_locations
  FOR DELETE TO authenticated
  USING (
    (company_id = current_company_id() AND has_permission('stock.delete'::text))
    OR is_super_admin()
  );
