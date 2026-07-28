-- 1) Fix mutable search_path on internal helper
CREATE OR REPLACE FUNCTION public._visit_path_uuid(_name text, _seg integer)
  RETURNS uuid
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path = public
AS $function$
DECLARE
  v_part text;
  v_uuid uuid;
BEGIN
  IF _name IS NULL OR _seg < 1 THEN RETURN NULL; END IF;
  v_part := split_part(_name, '/', _seg);
  IF v_part IS NULL OR v_part = '' THEN RETURN NULL; END IF;
  BEGIN
    v_uuid := v_part::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v_uuid;
END; $function$;

-- 2) Restrict plan catalog reads to authenticated users only
DROP POLICY IF EXISTS "plans_public_read" ON public.plans;
CREATE POLICY "plans_authenticated_read" ON public.plans
  FOR SELECT TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Plan features são públicos para leitura" ON public.plan_features;
CREATE POLICY "plan_features_authenticated_read" ON public.plan_features
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "plan_limits_public_read" ON public.plan_limits;
CREATE POLICY "plan_limits_authenticated_read" ON public.plan_limits
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Features são públicas para leitura" ON public.features;
CREATE POLICY "features_authenticated_read" ON public.features
  FOR SELECT TO authenticated
  USING (true);

-- 3) Harden so_photos_delete: verify ownership via service_order_photos.uploaded_by
DROP POLICY IF EXISTS "so_photos_delete" ON storage.objects;
CREATE POLICY "so_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-order-photos'
    AND (storage.foldername(name))[1] = (current_company_id())::text
    AND (
      EXISTS (
        SELECT 1 FROM public.service_order_photos p
        WHERE p.file_url = storage.objects.name
          AND p.uploaded_by = auth.uid()
      )
      OR has_permission('service_orders.delete_photos'::text)
      OR has_company_role('owner'::app_role)
      OR is_super_admin()
    )
  );