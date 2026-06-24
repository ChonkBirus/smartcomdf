
-- Rename permissions slugs to align with clients module
UPDATE public.permissions SET slug = 'clients.import', module = 'clients' WHERE slug = 'customers.import';
UPDATE public.permissions SET slug = 'clients.import.confirm', module = 'clients' WHERE slug = 'customers.import.confirm';
UPDATE public.permissions SET slug = 'clients.import.view_history', module = 'clients' WHERE slug = 'customers.import.view_history';

-- Recreate policies on customer_import_jobs
DROP POLICY IF EXISTS "cij_insert_own_company" ON public.customer_import_jobs;
DROP POLICY IF EXISTS "cij_update_own_company" ON public.customer_import_jobs;
DROP POLICY IF EXISTS "cij_delete_own_company" ON public.customer_import_jobs;
CREATE POLICY "cij_insert_own_company" ON public.customer_import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND created_by = auth.uid()
    AND public.has_permission('clients.import')
  );
CREATE POLICY "cij_update_own_company" ON public.customer_import_jobs
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('clients.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "cij_delete_own_company" ON public.customer_import_jobs
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('clients.import'));

-- Recreate policies on customer_import_rows
DROP POLICY IF EXISTS "cir_insert_own_company" ON public.customer_import_rows;
DROP POLICY IF EXISTS "cir_update_own_company" ON public.customer_import_rows;
DROP POLICY IF EXISTS "cir_delete_own_company" ON public.customer_import_rows;
CREATE POLICY "cir_insert_own_company" ON public.customer_import_rows
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('clients.import')
  );
CREATE POLICY "cir_update_own_company" ON public.customer_import_rows
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('clients.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "cir_delete_own_company" ON public.customer_import_rows
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('clients.import'));
