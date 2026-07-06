
CREATE OR REPLACE FUNCTION public.prevent_self_company_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow anything for super admins or when running as service_role (no auth.uid()).
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Users inserting their own profile row cannot pick an arbitrary company.
    IF NEW.id = auth.uid() AND NEW.company_id IS NOT NULL THEN
      RAISE EXCEPTION 'company_id cannot be set on your own profile; use the invitation flow'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Users updating their own profile row cannot change company_id.
    IF NEW.id = auth.uid()
       AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'company_id cannot be changed on your own profile'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_company_change_trg ON public.profiles;
CREATE TRIGGER prevent_self_company_change_trg
BEFORE INSERT OR UPDATE OF company_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_company_change();
