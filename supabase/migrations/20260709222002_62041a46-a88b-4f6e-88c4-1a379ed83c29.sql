
-- 1) billing_provider_settings: enforce column-level exposure
REVOKE SELECT ON public.billing_provider_settings FROM authenticated;
GRANT SELECT (
  id, provider, environment, active,
  terms_of_use_url, privacy_policy_url,
  support_whatsapp, support_email,
  created_at, updated_at
) ON public.billing_provider_settings TO authenticated;

-- 2) cnpj_lookup_logs: explicit deny for authenticated writes (defense-in-depth)
CREATE POLICY "cnpj logs deny insert" ON public.cnpj_lookup_logs
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "cnpj logs deny update" ON public.cnpj_lookup_logs
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "cnpj logs deny delete" ON public.cnpj_lookup_logs
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- 3) has_company_role: standardize on canonical membership (profiles + profile_roles)
CREATE OR REPLACE FUNCTION public.has_company_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = _role
      AND (
        ur.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR ur.company_id IN (SELECT company_id FROM public.profile_roles WHERE profile_id = auth.uid())
      )
  )
$function$;
