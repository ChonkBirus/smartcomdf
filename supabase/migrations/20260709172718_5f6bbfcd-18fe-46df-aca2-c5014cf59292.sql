DROP POLICY IF EXISTS soi_delete_owner_only ON public.service_order_items;
CREATE POLICY soi_delete_owner_only ON public.service_order_items
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (company_id = current_company_id() AND has_company_role('owner'::app_role))
);