
REVOKE EXECUTE ON FUNCTION public.can_access_service_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_service_order(UUID) TO authenticated;
