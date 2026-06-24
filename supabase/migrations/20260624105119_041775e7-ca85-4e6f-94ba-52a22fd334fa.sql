CREATE TABLE public.product_import_jobs (
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
  stock_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_pij_company ON public.product_import_jobs(company_id, created_at DESC);
CREATE INDEX idx_pij_status ON public.product_import_jobs(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_import_jobs TO authenticated;
GRANT ALL ON public.product_import_jobs TO service_role;
ALTER TABLE public.product_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pij_select_own_company" ON public.product_import_jobs
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "pij_insert_own_company" ON public.product_import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND created_by = auth.uid()
    AND public.has_permission('products.import')
  );
CREATE POLICY "pij_update_own_company" ON public.product_import_jobs
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "pij_delete_own_company" ON public.product_import_jobs
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.import'));

CREATE TABLE public.product_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  import_job_id UUID NOT NULL REFERENCES public.product_import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapped_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_errors JSONB,
  action TEXT NOT NULL DEFAULT 'CREATE'
    CHECK (action IN ('CREATE','UPDATE','SKIP','ERROR')),
  matched_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','VALID','INVALID','IMPORTED','SKIPPED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pir_job ON public.product_import_rows(import_job_id, row_number);
CREATE INDEX idx_pir_company ON public.product_import_rows(company_id);
CREATE INDEX idx_pir_status ON public.product_import_rows(import_job_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_import_rows TO authenticated;
GRANT ALL ON public.product_import_rows TO service_role;
ALTER TABLE public.product_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pir_select_own_company" ON public.product_import_rows
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "pir_insert_own_company" ON public.product_import_rows
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_permission('products.import')
  );
CREATE POLICY "pir_update_own_company" ON public.product_import_rows
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.import'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "pir_delete_own_company" ON public.product_import_rows
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.import'));

CREATE TRIGGER trg_pij_updated_at BEFORE UPDATE ON public.product_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pir_updated_at BEFORE UPDATE ON public.product_import_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('products.import', 'products', 'import', 'Importar produtos por Excel/CSV'),
  ('products.import.confirm', 'products', 'import.confirm', 'Confirmar e executar importação de produtos'),
  ('products.import.view_history', 'products', 'import.view_history', 'Visualizar histórico de importações de produtos')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM public.role_permissions rp
JOIN public.permissions pm ON pm.id = rp.permission_id AND pm.slug = 'products.manage'
CROSS JOIN public.permissions p
WHERE p.slug IN ('products.import','products.import.confirm','products.import.view_history')
ON CONFLICT DO NOTHING;

CREATE POLICY "product_imports_select_own_company"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-imports'
    AND (storage.foldername(name))[1]::uuid = public.current_company_id()
  );
CREATE POLICY "product_imports_insert_own_company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-imports'
    AND (storage.foldername(name))[1]::uuid = public.current_company_id()
    AND public.has_permission('products.import')
  );
CREATE POLICY "product_imports_update_own_company"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-imports'
    AND (storage.foldername(name))[1]::uuid = public.current_company_id()
  );
CREATE POLICY "product_imports_delete_own_company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-imports'
    AND (storage.foldername(name))[1]::uuid = public.current_company_id()
    AND public.has_permission('products.import')
  );