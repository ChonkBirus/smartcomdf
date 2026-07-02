
REVOKE EXECUTE ON FUNCTION public.crm_on_company_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_opp_timeline_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_touch_updated_at() FROM PUBLIC, anon, authenticated;
