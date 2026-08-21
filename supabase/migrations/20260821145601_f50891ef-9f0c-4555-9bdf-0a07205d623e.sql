-- project_items: add permission gating
DROP POLICY IF EXISTS project_items_insert_own_company ON public.project_items;
DROP POLICY IF EXISTS project_items_update_own_company ON public.project_items;
DROP POLICY IF EXISTS project_items_delete_own_company ON public.project_items;

CREATE POLICY project_items_insert_own_company ON public.project_items
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND (
    public.has_permission('projects.create')
    OR public.has_permission('projects.edit')
    OR public.has_company_role('owner'::app_role)
    OR public.is_super_admin()
  )
);

CREATE POLICY project_items_update_own_company ON public.project_items
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND (
    public.has_permission('projects.edit')
    OR public.has_company_role('owner'::app_role)
    OR public.is_super_admin()
  )
)
WITH CHECK (company_id = current_company_id());

CREATE POLICY project_items_delete_own_company ON public.project_items
FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id = current_company_id()
    AND (
      public.has_permission('projects.edit')
      OR public.has_company_role('owner'::app_role)
    )
  )
);

-- quote_payments: add finance permission gating
DROP POLICY IF EXISTS quote_payments_insert_own_company ON public.quote_payments;
DROP POLICY IF EXISTS quote_payments_update_own_company ON public.quote_payments;
DROP POLICY IF EXISTS quote_payments_delete_own_company ON public.quote_payments;

CREATE POLICY quote_payments_insert_own_company ON public.quote_payments
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND (
    public.has_permission('financial.create')
    OR public.has_permission('financial.edit')
    OR public.has_permission('financial.manage')
    OR public.has_company_role('owner'::app_role)
    OR public.is_super_admin()
  )
);

CREATE POLICY quote_payments_update_own_company ON public.quote_payments
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND (
    public.has_permission('financial.edit')
    OR public.has_permission('financial.manage')
    OR public.has_company_role('owner'::app_role)
    OR public.is_super_admin()
  )
)
WITH CHECK (company_id = current_company_id());

CREATE POLICY quote_payments_delete_own_company ON public.quote_payments
FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id = current_company_id()
    AND (
      public.has_permission('financial.delete')
      OR public.has_permission('financial.manage')
      OR public.has_company_role('owner'::app_role)
    )
  )
);