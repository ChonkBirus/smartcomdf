
-- Harden has_company_role: scope to current company only (remove cross-company profile_roles branch)
CREATE OR REPLACE FUNCTION public.has_company_role(_role app_role)
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
      AND ur.company_id = public.current_company_id()
  )
$function$;

-- Overload with explicit company_id for defense-in-depth in new policies
CREATE OR REPLACE FUNCTION public.has_company_role(_role app_role, _company_id uuid)
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
      AND ur.company_id = _company_id
  )
$function$;

-- Tighten service_orders DELETE to include company scoping (owner within company OR super admin)
DROP POLICY IF EXISTS so_delete_owner_only ON public.service_orders;
CREATE POLICY so_delete_owner_only ON public.service_orders
FOR DELETE
USING (
  public.is_super_admin()
  OR (
    company_id = public.current_company_id()
    AND public.has_company_role('owner', company_id)
  )
);
