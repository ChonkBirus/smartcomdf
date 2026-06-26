
-- 1) billing_provider_settings: allow authenticated read for non-secret config
CREATE POLICY "ps authenticated read public config"
  ON public.billing_provider_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) cnpj_lookup_cache: allow authenticated read; writes restricted to service_role
CREATE POLICY "cnpj cache authenticated read"
  ON public.cnpj_lookup_cache
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.cnpj_lookup_cache TO authenticated;
GRANT ALL ON public.cnpj_lookup_cache TO service_role;

-- 3) Revoke EXECUTE from authenticated on internal-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_role_to_profile_roles() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.quotes_audit_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.quote_recalc_totals(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.quotes_mark_expired() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(uuid, uuid, stock_movement_type, numeric, text, text, uuid, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_subscription_for_company() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_trials_and_subscriptions(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_activity(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_project_number(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_quote_number(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_service_order_number(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_so_report_number(uuid) FROM authenticated;
