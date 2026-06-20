
-- Phase 3: helper log functions, realtime, and admin RPC

-- log_audit: insert audit_log scoped to caller's company
CREATE OR REPLACE FUNCTION public.log_audit(
  _module TEXT,
  _action TEXT,
  _record_id UUID DEFAULT NULL,
  _old_data JSONB DEFAULT NULL,
  _new_data JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  new_id UUID;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  INSERT INTO public.audit_logs (user_id, company_id, module, action, record_id, old_data, new_data)
    VALUES (uid, cid, _module, _action, _record_id, _old_data, _new_data)
    RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- log_activity: short activity feed entry
CREATE OR REPLACE FUNCTION public.log_activity(_description TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  new_id UUID;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.activity_logs (user_id, company_id, description)
    VALUES (uid, cid, _description) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- notify_user: insert in-app notification
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id UUID,
  _company_id UUID,
  _title TEXT,
  _message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, company_id, title, message)
    VALUES (_user_id, _company_id, _title, _message)
    RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- Admin overview RPC: stats per company (super admin only)
CREATE OR REPLACE FUNCTION public.admin_companies_overview()
RETURNS TABLE (
  id UUID,
  corporate_name TEXT,
  trade_name TEXT,
  cnpj TEXT,
  status company_status,
  plan_name TEXT,
  plan_slug TEXT,
  users_count BIGINT,
  created_at TIMESTAMPTZ,
  subscription_trial BOOLEAN,
  subscription_active BOOLEAN,
  subscription_expires TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT c.id, c.corporate_name, c.trade_name, c.cnpj, c.status,
           p.name, p.slug,
           (SELECT COUNT(*) FROM public.profiles pr WHERE pr.company_id = c.id),
           c.created_at,
           s.trial, s.active, s.expiration_date
    FROM public.companies c
    LEFT JOIN public.plans p ON p.id = c.plan_id
    LEFT JOIN LATERAL (
      SELECT trial, active, expiration_date FROM public.subscriptions
      WHERE company_id = c.id ORDER BY created_at DESC LIMIT 1
    ) s ON TRUE
    ORDER BY c.created_at DESC;
END; $$;

-- Admin: set company status
CREATE OR REPLACE FUNCTION public.admin_set_company_status(_company_id UUID, _status company_status)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
  UPDATE public.companies SET status = _status, updated_at = now() WHERE id = _company_id;
END; $$;

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
