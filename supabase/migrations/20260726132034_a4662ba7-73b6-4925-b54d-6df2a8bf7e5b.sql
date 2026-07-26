REVOKE EXECUTE ON FUNCTION public.create_service_order_from_project(uuid, uuid, uuid) FROM anon;
NOTIFY pgrst, 'reload schema';
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.create_service_order_from_project(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon ainda tem EXECUTE na RPC.';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_service_order_from_project(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated deveria ter EXECUTE.';
  END IF;
END $$;