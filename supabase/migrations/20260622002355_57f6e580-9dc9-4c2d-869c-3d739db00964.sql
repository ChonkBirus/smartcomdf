
-- ============================================================
-- STOCK MODULE: locations, movements, balances
-- ============================================================

-- Enum
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('ENTRY','EXIT','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- stock_locations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_locations_company ON public.stock_locations(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_company_name ON public.stock_locations(company_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_locations TO authenticated;
GRANT ALL ON public.stock_locations TO service_role;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_locations_select ON public.stock_locations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY stock_locations_insert ON public.stock_locations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_permission('stock.create'));
CREATE POLICY stock_locations_update ON public.stock_locations FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('stock.edit'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY stock_locations_delete ON public.stock_locations FOR DELETE TO authenticated
  USING (FALSE);

CREATE TRIGGER trg_stock_locations_updated BEFORE UPDATE ON public.stock_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- stock_movements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  movement_type public.stock_movement_type NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  previous_balance NUMERIC(14,3) NOT NULL DEFAULT 0,
  new_balance NUMERIC(14,3) NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  related_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_mov_company ON public.stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_location ON public.stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_mov_created ON public.stock_movements(created_at DESC);

GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_mov_select ON public.stock_movements FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
-- Inserts happen through SECURITY DEFINER RPCs only
CREATE POLICY stock_mov_insert ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (FALSE);

-- ============================================================
-- stock_balances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_bal_company ON public.stock_balances(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_bal_item ON public.stock_balances(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_bal_location ON public.stock_balances(location_id);

GRANT SELECT ON public.stock_balances TO authenticated;
GRANT ALL ON public.stock_balances TO service_role;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_bal_select ON public.stock_balances FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());

-- ============================================================
-- Core RPC: apply_stock_movement
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _item_id UUID,
  _location_id UUID,
  _movement_type public.stock_movement_type,
  _quantity NUMERIC,
  _reason TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _related_movement_id UUID DEFAULT NULL,
  _final_quantity NUMERIC DEFAULT NULL  -- for ADJUSTMENT: target final balance
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  item_company UUID;
  item_controls BOOLEAN;
  item_type_v TEXT;
  item_min NUMERIC;
  item_name TEXT;
  loc_company UUID;
  prev_bal NUMERIC := 0;
  new_bal NUMERIC := 0;
  delta NUMERIC;
  perm_slug TEXT;
  mov_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Sem empresa.'; END IF;

  -- Validate item
  SELECT company_id, controls_stock, item_type::text, minimum_stock, name
    INTO item_company, item_controls, item_type_v, item_min, item_name
    FROM public.items WHERE id = _item_id;
  IF item_company IS NULL THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF item_company <> cid THEN RAISE EXCEPTION 'Item de outra empresa.'; END IF;
  IF item_type_v = 'SERVICE' THEN RAISE EXCEPTION 'Serviços não movimentam estoque.'; END IF;
  IF NOT COALESCE(item_controls, FALSE) THEN RAISE EXCEPTION 'Este item não controla estoque.'; END IF;

  -- Validate location
  SELECT company_id INTO loc_company FROM public.stock_locations WHERE id = _location_id AND active = TRUE;
  IF loc_company IS NULL THEN RAISE EXCEPTION 'Local inválido ou inativo.'; END IF;
  IF loc_company <> cid THEN RAISE EXCEPTION 'Local de outra empresa.'; END IF;

  -- Permission per movement
  perm_slug := CASE _movement_type
    WHEN 'ENTRY' THEN 'stock.create'
    WHEN 'EXIT' THEN 'stock.edit'
    WHEN 'ADJUSTMENT' THEN 'stock.adjust'
    WHEN 'TRANSFER_IN' THEN 'stock.transfer'
    WHEN 'TRANSFER_OUT' THEN 'stock.transfer'
  END;
  IF NOT public.has_permission(perm_slug) THEN
    RAISE EXCEPTION 'Sem permissão para esta operação (%).', perm_slug;
  END IF;

  -- Lock balance row (upsert blank)
  INSERT INTO public.stock_balances (company_id, item_id, location_id, quantity)
    VALUES (cid, _item_id, _location_id, 0)
    ON CONFLICT (item_id, location_id) DO NOTHING;

  SELECT quantity INTO prev_bal FROM public.stock_balances
    WHERE item_id = _item_id AND location_id = _location_id FOR UPDATE;

  IF _movement_type = 'ADJUSTMENT' THEN
    IF _final_quantity IS NULL OR _final_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade final inválida.';
    END IF;
    new_bal := _final_quantity;
    delta := abs(new_bal - prev_bal);
    IF delta = 0 THEN RAISE EXCEPTION 'Nenhuma diferença a registrar.'; END IF;
  ELSIF _movement_type IN ('ENTRY','TRANSFER_IN') THEN
    IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser positiva.'; END IF;
    new_bal := prev_bal + _quantity;
    delta := _quantity;
  ELSIF _movement_type IN ('EXIT','TRANSFER_OUT') THEN
    IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser positiva.'; END IF;
    IF prev_bal < _quantity THEN
      RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, solicitado: %.', prev_bal, _quantity;
    END IF;
    new_bal := prev_bal - _quantity;
    delta := _quantity;
  END IF;

  UPDATE public.stock_balances SET quantity = new_bal, updated_at = now()
    WHERE item_id = _item_id AND location_id = _location_id;

  INSERT INTO public.stock_movements
    (company_id, item_id, location_id, movement_type, quantity, previous_balance, new_balance, reason, notes, related_movement_id, user_id)
    VALUES (cid, _item_id, _location_id, _movement_type, delta, prev_bal, new_bal, _reason, _notes, _related_movement_id, uid)
    RETURNING id INTO mov_id;

  -- Audit
  PERFORM public.log_audit('stock', _movement_type::text, mov_id,
    NULL,
    jsonb_build_object('item_id', _item_id, 'location_id', _location_id, 'quantity', delta, 'previous_balance', prev_bal, 'new_balance', new_bal, 'reason', _reason));

  -- Low stock notification
  IF item_min IS NOT NULL AND item_min > 0 AND new_bal <= item_min AND new_bal < prev_bal THEN
    PERFORM public.notify_user(uid, cid,
      CASE WHEN new_bal = 0 THEN 'Item sem estoque' ELSE 'Estoque baixo' END,
      format('%s atingiu %s unidades (mínimo: %s).', item_name, new_bal, item_min));
  END IF;

  RETURN mov_id;
END $$;

GRANT EXECUTE ON FUNCTION public.apply_stock_movement(UUID,UUID,public.stock_movement_type,NUMERIC,TEXT,TEXT,UUID,NUMERIC) TO authenticated;

-- ============================================================
-- Transfer wrapper
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_stock(
  _item_id UUID,
  _from_location UUID,
  _to_location UUID,
  _quantity NUMERIC,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  out_id UUID;
  in_id UUID;
BEGIN
  IF _from_location = _to_location THEN RAISE EXCEPTION 'Origem e destino devem ser diferentes.'; END IF;
  out_id := public.apply_stock_movement(_item_id, _from_location, 'TRANSFER_OUT', _quantity, 'Transferência', _notes, NULL, NULL);
  in_id  := public.apply_stock_movement(_item_id, _to_location,   'TRANSFER_IN',  _quantity, 'Transferência', _notes, out_id, NULL);
  UPDATE public.stock_movements SET related_movement_id = in_id WHERE id = out_id;
  RETURN jsonb_build_object('out_id', out_id, 'in_id', in_id);
END $$;

GRANT EXECUTE ON FUNCTION public.transfer_stock(UUID,UUID,UUID,NUMERIC,TEXT) TO authenticated;

-- ============================================================
-- Permissions seed
-- ============================================================
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('stock.transfer', 'stock', 'transfer', 'Realizar transferências entre locais'),
  ('stock.adjust',   'stock', 'adjust',   'Realizar ajustes de saldo')
ON CONFLICT (slug) DO NOTHING;

-- Grant new perms to all existing roles that already had stock.edit
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p2.id
FROM public.role_permissions rp
JOIN public.permissions p1 ON p1.id = rp.permission_id AND p1.slug = 'stock.edit'
JOIN public.permissions p2 ON p2.slug IN ('stock.transfer','stock.adjust')
ON CONFLICT DO NOTHING;
