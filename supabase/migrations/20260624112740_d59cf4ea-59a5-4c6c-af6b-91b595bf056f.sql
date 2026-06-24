
CREATE TABLE public.customer_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN ('UPLOADED','MAPPED','VALIDATED','CONFIRMED','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  created_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  column_mapping JSONB,
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_cij_company ON public.customer_import_jobs(company_id, created_at DESC);
CREATE INDEX idx_cij_status ON public.customer_import_jobs(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_import_jobs TO authenticated;
GRANT ALL ON public.customer_import_jobs TO service_role;
ALTER TABLE public.customer_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cij_select_own_company" ON public.customer_import_jobs
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "cij_insert_own_company" ON public.customer_import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND created_by = auth.uid()
    AND public.has_permission('customers.import')
  );
CREATE POLICY "cij_update_own_company" ON public.customer_import_jobs
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('customers.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "cij_delete_own_company" ON public.customer_import_jobs
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('customers.import'));

CREATE TABLE public.customer_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  import_job_id UUID NOT NULL REFERENCES public.customer_import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapped_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_errors JSONB,
  action TEXT NOT NULL DEFAULT 'CREATE'
    CHECK (action IN ('CREATE','UPDATE','SKIP','ERROR')),
  matched_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','VALID','INVALID','IMPORTED','SKIPPED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cir_job ON public.customer_import_rows(import_job_id, row_number);
CREATE INDEX idx_cir_company ON public.customer_import_rows(company_id);
CREATE INDEX idx_cir_status ON public.customer_import_rows(import_job_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_import_rows TO authenticated;
GRANT ALL ON public.customer_import_rows TO service_role;
ALTER TABLE public.customer_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cir_select_own_company" ON public.customer_import_rows
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "cir_insert_own_company" ON public.customer_import_rows
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('customers.import')
  );
CREATE POLICY "cir_update_own_company" ON public.customer_import_rows
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('customers.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "cir_delete_own_company" ON public.customer_import_rows
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('customers.import'));

CREATE TRIGGER trg_cij_updated_at BEFORE UPDATE ON public.customer_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cir_updated_at BEFORE UPDATE ON public.customer_import_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('customers.import', 'customers', 'import', 'Importar clientes por Excel/CSV'),
  ('customers.import.confirm', 'customers', 'import.confirm', 'Confirmar e executar importação de clientes'),
  ('customers.import.view_history', 'customers', 'import.view_history', 'Visualizar histórico de importações de clientes')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM public.role_permissions rp
JOIN public.permissions pm ON pm.id = rp.permission_id AND pm.slug = 'clients.manage'
CROSS JOIN public.permissions p
WHERE p.slug IN ('customers.import','customers.import.confirm','customers.import.view_history')
ON CONFLICT DO NOTHING;
