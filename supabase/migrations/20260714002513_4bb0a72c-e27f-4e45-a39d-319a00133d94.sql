
-- Restrict storage policies to authenticated role
DROP POLICY IF EXISTS "payment_receipts_delete_internal" ON storage.objects;
CREATE POLICY "payment_receipts_delete_internal" ON storage.objects FOR DELETE TO authenticated
USING ((bucket_id = 'payment-receipts') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND (has_permission('finance.receivables.manage') OR has_permission('finance.manage') OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "payment_receipts_update_internal" ON storage.objects;
CREATE POLICY "payment_receipts_update_internal" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'payment-receipts') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND (has_permission('finance.receivables.manage') OR has_permission('finance.manage') OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "so_rep_delete" ON storage.objects;
CREATE POLICY "so_rep_delete" ON storage.objects FOR DELETE TO authenticated
USING ((bucket_id = 'service-order-reports') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

DROP POLICY IF EXISTS "so_rep_insert" ON storage.objects;
CREATE POLICY "so_rep_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK ((bucket_id = 'service-order-reports') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

DROP POLICY IF EXISTS "so_rep_select" ON storage.objects;
CREATE POLICY "so_rep_select" ON storage.objects FOR SELECT TO authenticated
USING ((bucket_id = 'service-order-reports') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

DROP POLICY IF EXISTS "so_rep_update" ON storage.objects;
CREATE POLICY "so_rep_update" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'service-order-reports') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

DROP POLICY IF EXISTS "so_sig_delete" ON storage.objects;
CREATE POLICY "so_sig_delete" ON storage.objects FOR DELETE TO authenticated
USING ((bucket_id = 'service-order-signatures') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

DROP POLICY IF EXISTS "so_sig_insert" ON storage.objects;
CREATE POLICY "so_sig_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK ((bucket_id = 'service-order-signatures') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

DROP POLICY IF EXISTS "so_sig_select" ON storage.objects;
CREATE POLICY "so_sig_select" ON storage.objects FOR SELECT TO authenticated
USING ((bucket_id = 'service-order-signatures') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

DROP POLICY IF EXISTS "so_sig_update" ON storage.objects;
CREATE POLICY "so_sig_update" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'service-order-signatures') AND ((storage.foldername(name))[1] = (current_company_id())::text) AND can_access_service_order((NULLIF((storage.foldername(name))[2], ''))::uuid));

-- Tighten CNPJ cache read: only fresh (<= 30 days) entries; still shared cache but time-bounded.
DROP POLICY IF EXISTS "cnpj cache authenticated read" ON public.cnpj_lookup_cache;
CREATE POLICY "cnpj cache authenticated read" ON public.cnpj_lookup_cache
FOR SELECT TO authenticated
USING (fetched_at > (now() - interval '30 days'));
