
REVOKE EXECUTE ON FUNCTION public.log_audit(TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_user(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_companies_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_company_status(UUID, company_status) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.log_audit(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_companies_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_company_status(UUID, company_status) TO authenticated;
