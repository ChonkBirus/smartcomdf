
-- =============== JOBS ===============
CREATE TABLE public.supplier_import_jobs (
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
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_import_jobs TO authenticated;
GRANT ALL ON public.supplier_import_jobs TO service_role;
ALTER TABLE public.supplier_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sij_select_own_company" ON public.supplier_import_jobs
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "sij_insert_own_company" ON public.supplier_import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND created_by = auth.uid()
    AND public.has_permission('suppliers.import')
  );
CREATE POLICY "sij_update_own_company" ON public.supplier_import_jobs
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('suppliers.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "sij_delete_own_company" ON public.supplier_import_jobs
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('suppliers.import'));

CREATE TRIGGER set_supplier_import_jobs_updated_at
  BEFORE UPDATE ON public.supplier_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_supplier_import_jobs_company ON public.supplier_import_jobs(company_id, created_at DESC);

-- =============== ROWS ===============
CREATE TABLE public.supplier_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  import_job_id UUID NOT NULL REFERENCES public.supplier_import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  mapped_data JSONB,
  validation_errors JSONB,
  action TEXT NOT NULL DEFAULT 'CREATE'
    CHECK (action IN ('CREATE','UPDATE','SKIP','ERROR')),
  matched_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','VALID','INVALID','IMPORTED','SKIPPED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_import_rows TO authenticated;
GRANT ALL ON public.supplier_import_rows TO service_role;
ALTER TABLE public.supplier_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sir_select_own_company" ON public.supplier_import_rows
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "sir_insert_own_company" ON public.supplier_import_rows
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('suppliers.import')
  );
CREATE POLICY "sir_update_own_company" ON public.supplier_import_rows
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('suppliers.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "sir_delete_own_company" ON public.supplier_import_rows
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('suppliers.import'));

CREATE TRIGGER set_supplier_import_rows_updated_at
  BEFORE UPDATE ON public.supplier_import_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_supplier_import_rows_job ON public.supplier_import_rows(import_job_id, row_number);

-- =============== PERMISSIONS ===============
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('suppliers.import', 'suppliers', 'import', 'Importar fornecedores'),
  ('suppliers.import.confirm', 'suppliers', 'import.confirm', 'Confirmar importação de fornecedores'),
  ('suppliers.import.view_history', 'suppliers', 'import.view_history', 'Ver histórico de importações de fornecedores')
ON CONFLICT (slug) DO NOTHING;

-- Grant to roles that can manage suppliers
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.slug IN ('suppliers.import','suppliers.import.confirm','suppliers.import.view_history')
JOIN public.role_permissions rp ON rp.role_id = r.id
JOIN public.permissions pm ON pm.id = rp.permission_id AND pm.slug = 'suppliers.create'
ON CONFLICT DO NOTHING;
