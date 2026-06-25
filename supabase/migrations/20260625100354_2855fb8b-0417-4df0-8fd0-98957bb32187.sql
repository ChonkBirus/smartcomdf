
-- 1) cnpj_lookup_cache: remove public-authenticated SELECT; reads happen via server function using service role
DROP POLICY IF EXISTS "auth read cache" ON public.cnpj_lookup_cache;

-- 2) billing_provider_settings: restrict reads to super admins (super admin all policy remains)
DROP POLICY IF EXISTS "ps authenticated read active" ON public.billing_provider_settings;

-- 3) Drop duplicate conflicting storage policies on service-order-photos
DROP POLICY IF EXISTS "so_photos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "so_photos_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "so_photos_storage_select" ON storage.objects;

-- 4) Revoke EXECUTE on SECURITY DEFINER public-schema functions from anon (and PUBLIC),
--    keeping the few intentional public-token RPCs accessible to anon.
DO $$
DECLARE
  r RECORD;
  keep TEXT[] := ARRAY[
    'accept_public_quote',
    'get_public_quote_by_token',
    'get_public_so_report',
    'register_public_quote_view'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    IF r.proname = ANY(keep) THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
  END LOOP;
END $$;
