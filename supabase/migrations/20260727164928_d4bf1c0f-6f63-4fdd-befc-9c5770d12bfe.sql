
-- 1) Prevent non-super_admin from changing plan_id / status on companies
CREATE OR REPLACE FUNCTION public.prevent_company_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'Not allowed: plan_id can only be changed by super_admin or billing processes'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Not allowed: status can only be changed by super_admin or billing processes'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_company_billing_self_update ON public.companies;
CREATE TRIGGER trg_prevent_company_billing_self_update
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.prevent_company_billing_self_update();

-- 2) Require finance.manage permission to update financial_transactions
DROP POLICY IF EXISTS fin_tx_update ON public.financial_transactions;
CREATE POLICY fin_tx_update ON public.financial_transactions
FOR UPDATE
TO authenticated
USING (is_company_member(company_id) AND public.has_permission('finance.manage'))
WITH CHECK (is_company_member(company_id) AND public.has_permission('finance.manage'));
