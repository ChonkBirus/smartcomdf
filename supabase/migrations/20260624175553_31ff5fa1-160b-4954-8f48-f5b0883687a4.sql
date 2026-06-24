
-- ============================================================
-- FASE 2.6C — ETAPA A: DB + STORAGE + RLS + RBAC
-- ============================================================

-- 1) Campos novos em service_orders ---------------------------
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS report_status TEXT NOT NULL DEFAULT 'NOT_GENERATED',
  ADD COLUMN IF NOT EXISTS stock_deduction_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS final_report_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_report_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock_deducted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock_deducted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS so_report_status_chk,
  DROP CONSTRAINT IF EXISTS so_stock_deduction_status_chk;

ALTER TABLE public.service_orders
  ADD CONSTRAINT so_report_status_chk
    CHECK (report_status IN ('NOT_GENERATED','GENERATED','SIGNED','SENT')),
  ADD CONSTRAINT so_stock_deduction_status_chk
    CHECK (stock_deduction_status IN ('PENDING','DEDUCTED','BLOCKED','NOT_APPLICABLE'));

-- 2) Referência em stock_movements ----------------------------
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id   UUID;

CREATE INDEX IF NOT EXISTS idx_stock_mov_reference
  ON public.stock_movements (reference_type, reference_id);

-- 3) service_order_reports ------------------------------------
CREATE TABLE IF NOT EXISTS public.service_order_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  report_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','GENERATED','SIGNED','SENT','CANCELLED')),
  public_token TEXT UNIQUE,
  pdf_file_url TEXT,
  pdf_file_name TEXT,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_reports TO authenticated;
GRANT ALL ON public.service_order_reports TO service_role;
ALTER TABLE public.service_order_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sor_company ON public.service_order_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_sor_so ON public.service_order_reports(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sor_token ON public.service_order_reports(public_token);

CREATE POLICY "sor_select" ON public.service_order_reports
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY "sor_modify" ON public.service_order_reports
  FOR ALL TO authenticated
  USING (public.can_access_service_order(service_order_id))
  WITH CHECK (public.can_access_service_order(service_order_id));

DROP TRIGGER IF EXISTS trg_sor_updated_at ON public.service_order_reports;
CREATE TRIGGER trg_sor_updated_at BEFORE UPDATE ON public.service_order_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) service_order_signatures ---------------------------------
CREATE TABLE IF NOT EXISTS public.service_order_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.service_order_reports(id) ON DELETE SET NULL,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('CUSTOMER','TECHNICIAN')),
  signer_name TEXT NOT NULL,
  signer_document TEXT,
  signer_email TEXT,
  signer_phone TEXT,
  signature_file_url TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_signatures TO authenticated;
GRANT ALL ON public.service_order_signatures TO service_role;
ALTER TABLE public.service_order_signatures ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sos_company ON public.service_order_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_sos_so ON public.service_order_signatures(service_order_id);

CREATE POLICY "sos_select" ON public.service_order_signatures
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY "sos_modify" ON public.service_order_signatures
  FOR ALL TO authenticated
  USING (public.can_access_service_order(service_order_id))
  WITH CHECK (public.can_access_service_order(service_order_id));

-- 5) service_order_report_send_events -------------------------
CREATE TABLE IF NOT EXISTS public.service_order_report_send_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.service_order_reports(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP','EMAIL','COPY_LINK','PDF_DOWNLOAD','MANUAL')),
  recipient_name TEXT,
  recipient_contact TEXT,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('SENT','FAILED','COPIED','DOWNLOADED')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_report_send_events TO authenticated;
GRANT ALL ON public.service_order_report_send_events TO service_role;
ALTER TABLE public.service_order_report_send_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sorse_company ON public.service_order_report_send_events(company_id);
CREATE INDEX IF NOT EXISTS idx_sorse_so ON public.service_order_report_send_events(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sorse_report ON public.service_order_report_send_events(report_id);

CREATE POLICY "sorse_select" ON public.service_order_report_send_events
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY "sorse_modify" ON public.service_order_report_send_events
  FOR ALL TO authenticated
  USING (public.can_access_service_order(service_order_id))
  WITH CHECK (public.can_access_service_order(service_order_id));

-- 6) service_order_stock_deduction_logs -----------------------
CREATE TABLE IF NOT EXISTS public.service_order_stock_deduction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  material_usage_id UUID REFERENCES public.service_order_material_usage(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  stock_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  stock_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('DEDUCTED','BLOCKED','FAILED')),
  error_message TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_stock_deduction_logs TO authenticated;
GRANT ALL ON public.service_order_stock_deduction_logs TO service_role;
ALTER TABLE public.service_order_stock_deduction_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sosdl_company ON public.service_order_stock_deduction_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_sosdl_so ON public.service_order_stock_deduction_logs(service_order_id);

CREATE POLICY "sosdl_select" ON public.service_order_stock_deduction_logs
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY "sosdl_modify" ON public.service_order_stock_deduction_logs
  FOR ALL TO authenticated
  USING (public.can_access_service_order(service_order_id))
  WITH CHECK (public.can_access_service_order(service_order_id));

-- 7) Permissões RBAC ------------------------------------------
INSERT INTO public.permissions (module, slug, action, description)
VALUES
  ('service_orders','service_orders.collect_signature','collect_signature','Coletar assinatura eletrônica do cliente na OS'),
  ('service_orders','service_orders.generate_final_report','generate_final_report','Gerar relatório final da OS concluída'),
  ('service_orders','service_orders.send_final_report','send_final_report','Enviar relatório final por WhatsApp ou e-mail'),
  ('service_orders','service_orders.download_final_report','download_final_report','Baixar o PDF do relatório final'),
  ('service_orders','service_orders.deduct_stock','deduct_stock','Realizar baixa de estoque dos materiais utilizados'),
  ('service_orders','service_orders.view_public_report_link','view_public_report_link','Ver/copiar o link público seguro do relatório')
ON CONFLICT (slug) DO NOTHING;

-- Conceder a quem já tem finish_execution (papéis de gerente)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM public.role_permissions rp
JOIN public.permissions pmgr ON pmgr.id = rp.permission_id AND pmgr.slug = 'service_orders.finish_execution'
CROSS JOIN public.permissions p
WHERE p.slug IN (
  'service_orders.collect_signature',
  'service_orders.generate_final_report',
  'service_orders.send_final_report',
  'service_orders.download_final_report',
  'service_orders.deduct_stock',
  'service_orders.view_public_report_link'
)
ON CONFLICT DO NOTHING;

-- Técnico (quem tem execute) recebe apenas collect_signature
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM public.role_permissions rp
JOIN public.permissions pex ON pex.id = rp.permission_id AND pex.slug = 'service_orders.execute'
CROSS JOIN public.permissions p
WHERE p.slug = 'service_orders.collect_signature'
ON CONFLICT DO NOTHING;

-- 8) Storage RLS — bucket service-order-signatures ------------
-- Caminho: {company_id}/{service_order_id}/{signature_id}.png
DROP POLICY IF EXISTS "so_sig_select" ON storage.objects;
DROP POLICY IF EXISTS "so_sig_insert" ON storage.objects;
DROP POLICY IF EXISTS "so_sig_update" ON storage.objects;
DROP POLICY IF EXISTS "so_sig_delete" ON storage.objects;

CREATE POLICY "so_sig_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-order-signatures'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );
CREATE POLICY "so_sig_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-order-signatures'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );
CREATE POLICY "so_sig_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'service-order-signatures'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );
CREATE POLICY "so_sig_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-order-signatures'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- 9) Storage RLS — bucket service-order-reports ---------------
DROP POLICY IF EXISTS "so_rep_select" ON storage.objects;
DROP POLICY IF EXISTS "so_rep_insert" ON storage.objects;
DROP POLICY IF EXISTS "so_rep_update" ON storage.objects;
DROP POLICY IF EXISTS "so_rep_delete" ON storage.objects;

CREATE POLICY "so_rep_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-order-reports'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );
CREATE POLICY "so_rep_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-order-reports'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );
CREATE POLICY "so_rep_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'service-order-reports'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );
CREATE POLICY "so_rep_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-order-reports'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );
