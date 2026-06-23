
-- 1) role_permissions: restrict modifications to super_admin only (was: any owner globally)
DROP POLICY IF EXISTS "rp_manage_admin" ON public.role_permissions;
CREATE POLICY "rp_manage_super_admin" ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 2) profile_roles: scope owner management to caller's company
DROP POLICY IF EXISTS "profile_roles_manage_owner" ON public.profile_roles;
CREATE POLICY "profile_roles_manage_owner" ON public.profile_roles FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_company_role('owner') AND company_id = public.current_company_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_company_role('owner') AND company_id = public.current_company_id())
  );

-- 3) items: add explicit DELETE policy gated on products.delete permission
DROP POLICY IF EXISTS "items_delete_own_company" ON public.items;
CREATE POLICY "items_delete_own_company" ON public.items FOR DELETE
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_permission('products.delete'))
  );

-- 4) notify_user: add caller-company guard so users can't inject notifications cross-tenant
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _company_id uuid, _title text, _message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id UUID;
  caller_company UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    SELECT company_id INTO caller_company FROM public.profiles WHERE id = auth.uid();
    IF caller_company IS NULL OR caller_company <> _company_id THEN
      RAISE EXCEPTION 'Não autorizado a enviar notificação para esta empresa.';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, company_id, title, message)
    VALUES (_user_id, _company_id, _title, _message)
    RETURNING id INTO new_id;
  RETURN new_id;
END; $function$;

-- 5) Revoke EXECUTE on internal/trigger SECURITY DEFINER functions that should never
--    be callable directly by anon or authenticated clients (lint 0028/0029).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_user_role_to_profile_roles() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.quote_recalc_totals(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.quotes_audit_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.quotes_mark_expired() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_quote_number(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_activity(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_companies_overview() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_company_status(uuid, public.company_status) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(uuid, uuid, public.stock_movement_type, numeric, text, text, uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_nota_receiving(uuid, uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid, uuid, jsonb, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, uuid, text, text) FROM anon, PUBLIC;

-- 6) realtime.messages: add RLS policy restricting subscriptions to per-user notification channel
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "realtime_user_own_notif_channel" ON realtime.messages;
CREATE POLICY "realtime_user_own_notif_channel" ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND realtime.topic() = 'notif-' || auth.uid()::text
  );
