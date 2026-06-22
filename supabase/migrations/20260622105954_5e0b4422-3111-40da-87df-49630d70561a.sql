
-- =========================================================
-- ITEMS: catálogo global futuro
-- =========================================================
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS global_catalog_id UUID;

-- =========================================================
-- FEATURES novas
-- =========================================================
INSERT INTO public.features (code, name, description, active)
VALUES
  ('suppliers', 'Fornecedores', 'Cadastro e gestão de fornecedores', TRUE),
  ('purchases', 'Compras', 'Pedidos de compra e recebimento', TRUE),
  ('smart_receiving', 'Recebimento Inteligente', 'Upload de nota fiscal com OCR + IA', TRUE),
  ('ai_parser', 'IA de documentos', 'Interpretação de notas fiscais por IA', TRUE)
ON CONFLICT (code) DO NOTHING;

-- plan_features
DO $$
DECLARE
  pid_starter UUID; pid_pro UUID; pid_business UUID;
  fid UUID;
BEGIN
  SELECT id INTO pid_starter FROM public.plans WHERE slug='starter';
  SELECT id INTO pid_pro     FROM public.plans WHERE slug='pro';
  SELECT id INTO pid_business FROM public.plans WHERE slug='business';

  FOR fid IN SELECT id FROM public.features WHERE code IN ('suppliers','purchases') LOOP
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
      VALUES (pid_starter, fid, TRUE) ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
      VALUES (pid_pro, fid, TRUE) ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
      VALUES (pid_business, fid, TRUE) ON CONFLICT DO NOTHING;
  END LOOP;

  FOR fid IN SELECT id FROM public.features WHERE code IN ('smart_receiving','ai_parser','ocr') LOOP
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
      VALUES (pid_pro, fid, TRUE) ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
      VALUES (pid_business, fid, TRUE) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- =========================================================
-- PERMISSIONS novas
-- =========================================================
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('suppliers.view', 'suppliers', 'view', 'Visualizar fornecedores'),
  ('suppliers.create', 'suppliers', 'create', 'Criar fornecedores'),
  ('suppliers.edit', 'suppliers', 'edit', 'Editar fornecedores'),
  ('suppliers.delete', 'suppliers', 'delete', 'Excluir/desativar fornecedores'),
  ('suppliers.manage', 'suppliers', 'manage', 'Gerenciar fornecedores'),
  ('purchases.view', 'purchases', 'view', 'Visualizar compras'),
  ('purchases.create', 'purchases', 'create', 'Criar pedidos de compra'),
  ('purchases.edit', 'purchases', 'edit', 'Editar pedidos de compra'),
  ('purchases.delete', 'purchases', 'delete', 'Excluir pedidos de compra'),
  ('purchases.approve', 'purchases', 'approve', 'Aprovar pedidos de compra'),
  ('purchases.cancel', 'purchases', 'cancel', 'Cancelar pedidos de compra'),
  ('purchases.receive', 'purchases', 'receive', 'Receber pedidos de compra'),
  ('purchases.manage', 'purchases', 'manage', 'Gerenciar compras'),
  ('smart_receiving.view', 'smart_receiving', 'view', 'Visualizar recebimentos inteligentes'),
  ('smart_receiving.upload', 'smart_receiving', 'upload', 'Enviar documentos'),
  ('smart_receiving.process', 'smart_receiving', 'process', 'Processar documentos com OCR/IA'),
  ('smart_receiving.confirm', 'smart_receiving', 'confirm', 'Confirmar recebimento')
ON CONFLICT (slug) DO NOTHING;

-- Conceder novas permissões aos perfis Owner/Admin (papéis padrão)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('owner', 'admin')
  AND p.module IN ('suppliers', 'purchases', 'smart_receiving')
ON CONFLICT DO NOTHING;

-- =========================================================
-- SUPPLIERS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  corporate_name TEXT NOT NULL,
  trade_name TEXT,
  cpf_cnpj TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  zipcode TEXT,
  address TEXT,
  number TEXT,
  complement TEXT,
  district TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_company_cnpj_unique
  ON public.suppliers (company_id, cpf_cnpj) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers (company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_cpf_cnpj ON public.suppliers (cpf_cnpj);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers select" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_super_admin() OR company_id = public.current_company_id());
CREATE POLICY "Suppliers insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_permission('suppliers.create') OR public.has_permission('suppliers.manage'))
  );
CREATE POLICY "Suppliers update" ON public.suppliers FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_permission('suppliers.edit') OR public.has_permission('suppliers.manage'))
  )
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Suppliers delete" ON public.suppliers FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_permission('suppliers.delete') OR public.has_permission('suppliers.manage'))
  );

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PURCHASE ORDERS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.purchase_order_status AS ENUM
    ('DRAFT','PENDING','APPROVED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  status public.purchase_order_status NOT NULL DEFAULT 'DRAFT',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_company_number_unique
  ON public.purchase_orders (company_id, order_number);
CREATE INDEX IF NOT EXISTS idx_po_company ON public.purchase_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_po_issue ON public.purchase_orders (issue_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PO select" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_super_admin() OR company_id = public.current_company_id());
CREATE POLICY "PO insert" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_permission('purchases.create') OR public.has_permission('purchases.manage'))
  );
CREATE POLICY "PO update" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.is_super_admin()
      OR public.has_permission('purchases.edit')
      OR public.has_permission('purchases.approve')
      OR public.has_permission('purchases.cancel')
      OR public.has_permission('purchases.receive')
      OR public.has_permission('purchases.manage')
    )
  )
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "PO delete" ON public.purchase_orders FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_permission('purchases.delete') OR public.has_permission('purchases.manage'))
  );

CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PURCHASE ORDER ITEMS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  received_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_po ON public.purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_item ON public.purchase_order_items (item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "POI select" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND (public.is_super_admin() OR po.company_id = public.current_company_id())
  ));
CREATE POLICY "POI insert" ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND po.company_id = public.current_company_id()
      AND (public.is_super_admin() OR public.has_permission('purchases.create') OR public.has_permission('purchases.edit') OR public.has_permission('purchases.manage'))
  ));
CREATE POLICY "POI update" ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND po.company_id = public.current_company_id()
      AND (public.is_super_admin() OR public.has_permission('purchases.edit') OR public.has_permission('purchases.receive') OR public.has_permission('purchases.manage'))
  ));
CREATE POLICY "POI delete" ON public.purchase_order_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND po.company_id = public.current_company_id()
      AND (public.is_super_admin() OR public.has_permission('purchases.edit') OR public.has_permission('purchases.manage'))
  ));

CREATE TRIGGER trg_poi_updated_at BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: validar item antes de inserir
CREATE OR REPLACE FUNCTION public.poi_validate_item()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  it_type TEXT; it_ctrl BOOLEAN; it_company UUID; po_company UUID;
BEGIN
  SELECT company_id INTO po_company FROM public.purchase_orders WHERE id = NEW.purchase_order_id;
  SELECT item_type::text, controls_stock, company_id INTO it_type, it_ctrl, it_company
    FROM public.items WHERE id = NEW.item_id;
  IF it_company IS NULL THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF it_company <> po_company THEN RAISE EXCEPTION 'Item de outra empresa.'; END IF;
  IF it_type = 'SERVICE' THEN RAISE EXCEPTION 'Serviços não podem ser comprados.'; END IF;
  IF NOT COALESCE(it_ctrl, FALSE) THEN RAISE EXCEPTION 'Este item não controla estoque.'; END IF;
  NEW.total_cost := ROUND(NEW.quantity * NEW.unit_cost, 2);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_poi_validate
  BEFORE INSERT OR UPDATE OF item_id, quantity, unit_cost ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.poi_validate_item();

-- Trigger: recalcula total do pedido
CREATE OR REPLACE FUNCTION public.po_recalc_total()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE po_id UUID;
BEGIN
  po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  UPDATE public.purchase_orders po
    SET total_amount = COALESCE((
      SELECT SUM(total_cost) FROM public.purchase_order_items WHERE purchase_order_id = po_id
    ), 0),
    updated_at = now()
    WHERE po.id = po_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_poi_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.po_recalc_total();

-- =========================================================
-- RPC: receive_purchase_order
-- =========================================================
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  _po_id UUID,
  _location_id UUID,
  _items JSONB,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  po_record RECORD;
  poi_record RECORD;
  item_in JSONB;
  qty NUMERIC;
  new_received NUMERIC;
  remaining NUMERIC;
  total_remaining NUMERIC := 0;
  movements UUID[] := ARRAY[]::UUID[];
  mov_id UUID;
  new_status public.purchase_order_status;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Sem empresa.'; END IF;

  IF NOT (public.is_super_admin() OR public.has_permission('purchases.receive') OR public.has_permission('purchases.manage')) THEN
    RAISE EXCEPTION 'Sem permissão para receber pedidos.';
  END IF;

  SELECT * INTO po_record FROM public.purchase_orders WHERE id = _po_id;
  IF po_record IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF po_record.company_id <> cid THEN RAISE EXCEPTION 'Pedido de outra empresa.'; END IF;
  IF po_record.status NOT IN ('APPROVED','PARTIALLY_RECEIVED') THEN
    RAISE EXCEPTION 'Pedido não está aprovado para recebimento (status: %).', po_record.status;
  END IF;

  -- Processar cada item recebido
  FOR item_in IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO poi_record FROM public.purchase_order_items
      WHERE id = (item_in->>'poi_id')::UUID AND purchase_order_id = _po_id;
    IF poi_record IS NULL THEN
      RAISE EXCEPTION 'Item do pedido não encontrado: %.', item_in->>'poi_id';
    END IF;

    qty := COALESCE((item_in->>'quantity')::NUMERIC, 0);
    IF qty <= 0 THEN CONTINUE; END IF;

    remaining := poi_record.quantity - poi_record.received_quantity;
    IF qty > remaining THEN
      RAISE EXCEPTION 'Quantidade % excede o pendente % do item.', qty, remaining;
    END IF;

    -- Entrada no estoque
    mov_id := public.apply_stock_movement(
      poi_record.item_id, _location_id, 'ENTRY', qty,
      'Recebimento PO ' || po_record.order_number,
      COALESCE(_notes, 'Recebimento de pedido de compra'),
      NULL, NULL
    );
    movements := array_append(movements, mov_id);

    -- Atualizar quantidade recebida
    new_received := poi_record.received_quantity + qty;
    UPDATE public.purchase_order_items
      SET received_quantity = new_received, updated_at = now()
      WHERE id = poi_record.id;
  END LOOP;

  -- Recalcular status do pedido
  SELECT COALESCE(SUM(quantity - received_quantity), 0) INTO total_remaining
    FROM public.purchase_order_items WHERE purchase_order_id = _po_id;

  IF total_remaining <= 0 THEN
    new_status := 'RECEIVED';
  ELSE
    new_status := 'PARTIALLY_RECEIVED';
  END IF;

  UPDATE public.purchase_orders SET status = new_status, updated_at = now() WHERE id = _po_id;

  PERFORM public.log_audit('purchases', 'receive', _po_id, NULL,
    jsonb_build_object('items', _items, 'location_id', _location_id, 'new_status', new_status, 'movements', movements));

  PERFORM public.notify_user(uid, cid,
    CASE WHEN new_status = 'RECEIVED' THEN 'Pedido recebido' ELSE 'Pedido parcialmente recebido' END,
    'Pedido ' || po_record.order_number || ' atualizado.');

  RETURN jsonb_build_object('status', new_status, 'movements', movements);
END $$;
