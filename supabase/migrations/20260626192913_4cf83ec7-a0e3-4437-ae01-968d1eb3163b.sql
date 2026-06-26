-- activity_logs: scope policies to authenticated
DROP POLICY IF EXISTS act_insert_company ON public.activity_logs;
DROP POLICY IF EXISTS act_select_company ON public.activity_logs;

CREATE POLICY act_insert_company ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = current_company_id());

CREATE POLICY act_select_company ON public.activity_logs
  FOR SELECT TO authenticated
  USING (company_id = current_company_id() OR is_super_admin());

-- billing_coupons: explicit super-admin-only SELECT (defense in depth)
CREATE POLICY billing_coupons_select_super ON public.billing_coupons
  FOR SELECT TO authenticated
  USING (is_super_admin());

-- is_company_member: also accept membership via profiles.company_id
CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE profile_id = auth.uid() AND company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND company_id = _company_id
  );
$function$;