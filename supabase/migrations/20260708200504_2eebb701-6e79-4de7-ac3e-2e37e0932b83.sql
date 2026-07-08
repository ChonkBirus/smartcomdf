
-- Backfill missing company_id on profile_roles from the user's profile
UPDATE public.profile_roles pr
SET company_id = p.company_id
FROM public.profiles p
WHERE pr.company_id IS NULL
  AND p.id = pr.profile_id
  AND p.company_id IS NOT NULL;

-- Harden has_permission to require the role assignment to belong to the active company
CREATE OR REPLACE FUNCTION public.has_permission(_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
BEGIN
  IF public.is_super_admin() OR public.has_company_role('owner') THEN
    RETURN TRUE;
  END IF;
  v_company := public.current_company_id();
  IF v_company IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE pr.profile_id = auth.uid()
      AND pr.company_id = v_company
      AND p.slug = _slug
  );
END; $function$;

-- Tighten storage SELECT on service-order-photos to assignment/permission-based access
DROP POLICY IF EXISTS "so_photos_select" ON storage.objects;
CREATE POLICY "so_photos_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'service-order-photos'
    AND (storage.foldername(name))[1] = (public.current_company_id())::text
    AND public.can_access_service_order(
      NULLIF((storage.foldername(name))[2], '')::uuid
    )
  );
