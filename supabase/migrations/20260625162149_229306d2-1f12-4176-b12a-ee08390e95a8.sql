
DROP FUNCTION IF EXISTS public.admin_companies_overview();

CREATE OR REPLACE FUNCTION public.admin_companies_overview()
RETURNS TABLE(
  id uuid,
  corporate_name text,
  trade_name text,
  cnpj text,
  status company_status,
  plan_id uuid,
  plan_name text,
  plan_slug text,
  users_count bigint,
  created_at timestamp with time zone,
  subscription_id uuid,
  subscription_status text,
  subscription_trial boolean,
  subscription_active boolean,
  subscription_expires timestamp with time zone,
  trial_ends_at timestamp with time zone,
  next_billing_date date,
  last_paid_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT c.id, c.corporate_name, c.trade_name, c.cnpj, c.status,
           p.id, p.name, p.slug,
           (SELECT COUNT(*) FROM public.profiles pr WHERE pr.company_id = c.id),
           c.created_at,
           s.id, s.status, s.trial, s.active, s.expiration_date,
           s.trial_ends_at, s.next_billing_date,
           (SELECT MAX(bc.paid_at) FROM public.billing_charges bc
              WHERE bc.company_id = c.id AND bc.status = 'RECEIVED')
    FROM public.companies c
    LEFT JOIN public.plans p ON p.id = c.plan_id
    LEFT JOIN LATERAL (
      SELECT id, status, trial, active, expiration_date, trial_ends_at, next_billing_date
      FROM public.subscriptions
      WHERE company_id = c.id ORDER BY created_at DESC LIMIT 1
    ) s ON TRUE
    ORDER BY c.created_at DESC;
END; $function$;

REVOKE ALL ON FUNCTION public.admin_companies_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_companies_overview() TO authenticated;
