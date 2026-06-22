
CREATE TYPE public.nota_document_status AS ENUM
  ('UPLOADED','PROCESSING','PARSED','REVIEWED','CONFIRMED','FAILED','CANCELLED');

CREATE TYPE public.nota_item_status AS ENUM
  ('PENDING','MATCHED','NEW','IGNORED');

CREATE TABLE public.nota_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  file_path TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  status public.nota_document_status NOT NULL DEFAULT 'UPLOADED',
  ai_supplier_name TEXT,
  ai_supplier_cnpj TEXT,
  ai_invoice_number TEXT,
  ai_issue_date DATE,
  ai_total_amount NUMERIC(14,2),
  ai_raw JSONB,
  ai_confidence NUMERIC(4,3),
  ai_model TEXT,
  error_message TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nota_documents_company ON public.nota_documents(company_id, created_at DESC);
CREATE INDEX idx_nota_documents_status ON public.nota_documents(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_documents TO authenticated;
GRANT ALL ON public.nota_documents TO service_role;
ALTER TABLE public.nota_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members view nota_documents"
  ON public.nota_documents FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "users insert own nota_documents"
  ON public.nota_documents FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND uploaded_by = auth.uid());
CREATE POLICY "company members update nota_documents"
  ON public.nota_documents FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "company members delete nota_documents"
  ON public.nota_documents FOR DELETE TO authenticated
  USING (company_id = public.current_company_id());

CREATE TRIGGER trg_nota_documents_updated
  BEFORE UPDATE ON public.nota_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.nota_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.nota_documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  line_no INT,
  raw_code TEXT,
  raw_name TEXT NOT NULL,
  raw_unit TEXT,
  raw_quantity NUMERIC(14,4),
  raw_unit_cost NUMERIC(14,4),
  raw_total NUMERIC(14,2),
  matched_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  match_confidence NUMERIC(4,3),
  match_reason TEXT,
  status public.nota_item_status NOT NULL DEFAULT 'PENDING',
  new_item_payload JSONB,
  created_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  confirmed_quantity NUMERIC(14,4),
  confirmed_unit_cost NUMERIC(14,4),
  stock_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nota_doc_items_doc ON public.nota_document_items(document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_document_items TO authenticated;
GRANT ALL ON public.nota_document_items TO service_role;
ALTER TABLE public.nota_document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members access nota items"
  ON public.nota_document_items FOR ALL TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.current_company_id());

CREATE TRIGGER trg_nota_document_items_updated
  BEFORE UPDATE ON public.nota_document_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_parser_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  source_code TEXT,
  target_id UUID,
  target_label TEXT,
  hits INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_corrections_lookup
  ON public.ai_parser_corrections(company_id, source_type, lower(source_text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_parser_corrections TO authenticated;
GRANT ALL ON public.ai_parser_corrections TO service_role;
ALTER TABLE public.ai_parser_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members access corrections"
  ON public.ai_parser_corrections FOR ALL TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.current_company_id());

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('smart_receiving.view', 'smart_receiving', 'view', 'Ver Recebimento Inteligente'),
  ('smart_receiving.upload', 'smart_receiving', 'upload', 'Enviar notas fiscais'),
  ('smart_receiving.process', 'smart_receiving', 'process', 'Processar notas com IA'),
  ('smart_receiving.confirm', 'smart_receiving', 'confirm', 'Confirmar entrada no estoque'),
  ('smart_receiving.delete', 'smart_receiving', 'delete', 'Excluir notas')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug IN ('admin','manager')
  AND p.slug IN ('smart_receiving.view','smart_receiving.upload','smart_receiving.process','smart_receiving.confirm','smart_receiving.delete')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, TRUE
FROM public.plans p CROSS JOIN public.features f
WHERE p.slug IN ('pro','business') AND f.code IN ('smart_receiving','ai_parser')
ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = TRUE;

CREATE OR REPLACE FUNCTION public.confirm_nota_receiving(
  _doc_id UUID,
  _location_id UUID,
  _supplier_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  doc RECORD;
  itm RECORD;
  new_item_id UUID;
  mov_id UUID;
  movements UUID[] := ARRAY[]::UUID[];
  created_items UUID[] := ARRAY[]::UUID[];
  payload JSONB;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Sem empresa.'; END IF;

  IF NOT (public.is_super_admin() OR public.has_company_role('owner')
          OR public.has_permission('smart_receiving.confirm')) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar recebimento.';
  END IF;

  SELECT * INTO doc FROM public.nota_documents
    WHERE id = _doc_id AND company_id = cid FOR UPDATE;
  IF doc IS NULL THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF doc.status = 'CONFIRMED' THEN RAISE EXCEPTION 'Documento já confirmado.'; END IF;

  IF _supplier_id IS NOT NULL AND doc.ai_supplier_name IS NOT NULL THEN
    INSERT INTO public.ai_parser_corrections
      (company_id, source_type, source_text, source_code, target_id, target_label, created_by)
      VALUES (cid, 'supplier', doc.ai_supplier_name, doc.ai_supplier_cnpj, _supplier_id, doc.ai_supplier_name, uid);
  END IF;

  FOR itm IN
    SELECT * FROM public.nota_document_items
      WHERE document_id = _doc_id AND status IN ('MATCHED','NEW')
  LOOP
    IF itm.status = 'NEW' AND itm.created_item_id IS NULL THEN
      payload := COALESCE(itm.new_item_payload, '{}'::jsonb);
      INSERT INTO public.items (
        company_id, name, sku, unit, item_type, controls_stock,
        cost_price, sale_price, active, minimum_stock
      ) VALUES (
        cid,
        COALESCE(payload->>'name', itm.raw_name),
        NULLIF(payload->>'sku', ''),
        COALESCE(NULLIF(payload->>'unit', ''), itm.raw_unit, 'UN'),
        'PRODUCT',
        TRUE,
        COALESCE((payload->>'cost_price')::NUMERIC, itm.raw_unit_cost, 0),
        COALESCE((payload->>'sale_price')::NUMERIC, 0),
        TRUE,
        COALESCE((payload->>'minimum_stock')::NUMERIC, 0)
      ) RETURNING id INTO new_item_id;

      UPDATE public.nota_document_items
        SET created_item_id = new_item_id, matched_item_id = new_item_id
        WHERE id = itm.id;
      itm.matched_item_id := new_item_id;
      created_items := array_append(created_items, new_item_id);

      INSERT INTO public.ai_parser_corrections
        (company_id, source_type, source_text, source_code, target_id, target_label, created_by)
        VALUES (cid, 'item', itm.raw_name, itm.raw_code, new_item_id,
                COALESCE(payload->>'name', itm.raw_name), uid);
    ELSIF itm.status = 'MATCHED' AND itm.matched_item_id IS NOT NULL THEN
      INSERT INTO public.ai_parser_corrections
        (company_id, source_type, source_text, source_code, target_id, target_label, created_by)
        VALUES (cid, 'item', itm.raw_name, itm.raw_code, itm.matched_item_id, itm.raw_name, uid);
    END IF;

    IF itm.matched_item_id IS NOT NULL
       AND COALESCE(itm.confirmed_quantity, itm.raw_quantity, 0) > 0 THEN
      mov_id := public.apply_stock_movement(
        itm.matched_item_id,
        _location_id,
        'ENTRY',
        COALESCE(itm.confirmed_quantity, itm.raw_quantity),
        format('Recebimento NF %s', COALESCE(doc.ai_invoice_number, doc.original_name, doc.id::text)),
        _notes,
        NULL,
        NULL
      );
      UPDATE public.nota_document_items SET stock_movement_id = mov_id WHERE id = itm.id;
      movements := array_append(movements, mov_id);
    END IF;
  END LOOP;

  UPDATE public.nota_documents
    SET status = 'CONFIRMED',
        confirmed_at = now(),
        location_id = _location_id,
        supplier_id = COALESCE(_supplier_id, supplier_id),
        notes = COALESCE(_notes, notes)
    WHERE id = _doc_id;

  PERFORM public.log_audit('smart_receiving', 'confirm', _doc_id, NULL,
    jsonb_build_object('movements', movements, 'created_items', created_items, 'location_id', _location_id));

  RETURN jsonb_build_object('movements', movements, 'created_items', created_items);
END $$;
