
-- 1. New permissions
INSERT INTO public.permissions (module, slug, action, description) VALUES
  ('service_orders', 'service_orders.delete_photos', 'delete_photos', 'Permite remover fotos da execução.'),
  ('service_orders', 'service_orders.override_required_checklist', 'override_required_checklist', 'Permite finalizar OS com checklist obrigatório pendente mediante justificativa.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug IN ('owner','manager')
  AND p.slug IN ('service_orders.delete_photos','service_orders.override_required_checklist')
ON CONFLICT DO NOTHING;

ALTER TABLE public.service_order_material_usage
  ADD COLUMN IF NOT EXISTS stock_warning BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS require_before_photo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_after_photo  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.service_order_execution_logs
  DROP CONSTRAINT IF EXISTS service_order_execution_logs_action_check;
ALTER TABLE public.service_order_execution_logs
  ADD CONSTRAINT service_order_execution_logs_action_check
  CHECK (action = ANY (ARRAY[
    'STARTED','PAUSED','RESUMED','FINISHED_EXECUTION','STATUS_CHANGED','NOTE_ADDED',
    'CHECKLIST_UPDATED','CHECKLIST_ITEM_ADDED',
    'PHOTO_ADDED','PHOTO_REMOVED',
    'MATERIAL_ADDED','MATERIAL_UPDATED','MATERIAL_STOCK_WARNING'
  ]));

-- Storage RLS for service-order-photos bucket
DROP POLICY IF EXISTS "so_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "so_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "so_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "so_photos_update" ON storage.objects;

CREATE POLICY "so_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-order-photos'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "so_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-order-photos'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND (
      public.has_permission('service_orders.upload_photos')
      OR public.has_permission('service_orders.execute')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
    AND public.can_access_service_order(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "so_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-order-photos'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND (
      owner = auth.uid()
      OR public.has_permission('service_orders.delete_photos')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
  );

CREATE OR REPLACE FUNCTION public.so_can_mutate_execution(_so_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_so public.service_orders; v_is_manager boolean;
BEGIN
  SELECT * INTO v_so FROM public.service_orders WHERE id = _so_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_so.company_id <> public.current_company_id() AND NOT public.is_super_admin() THEN
    RETURN false;
  END IF;
  v_is_manager := public.is_super_admin() OR public.has_company_role('owner')
                  OR public.has_permission('service_orders.edit');
  IF v_so.status IN ('CANCELLED','COMPLETED') AND NOT v_is_manager THEN RETURN false; END IF;
  IF v_so.status NOT IN ('IN_PROGRESS','PAUSED') AND NOT v_is_manager THEN RETURN false; END IF;
  IF NOT v_is_manager AND v_so.assigned_technician_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.so_can_mutate_execution(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_can_mutate_execution(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_checklist_toggle(_item_id uuid, _checked boolean, _notes text DEFAULT NULL)
RETURNS public.service_order_checklist_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.service_order_checklist_items;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_item FROM public.service_order_checklist_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item de checklist não encontrado.'; END IF;
  IF NOT public.so_can_mutate_execution(v_item.service_order_id) THEN
    RAISE EXCEPTION 'Você não pode alterar o checklist desta OS no momento.';
  END IF;
  UPDATE public.service_order_checklist_items SET
    checked = _checked,
    checked_by = CASE WHEN _checked THEN auth.uid() ELSE NULL END,
    checked_at = CASE WHEN _checked THEN now() ELSE NULL END,
    notes = COALESCE(_notes, notes),
    updated_at = now()
  WHERE id = _item_id RETURNING * INTO v_item;
  INSERT INTO public.service_order_execution_logs(company_id, service_order_id, user_id, action, notes, metadata)
    VALUES (v_item.company_id, v_item.service_order_id, auth.uid(), 'CHECKLIST_UPDATED',
            v_item.title || CASE WHEN _checked THEN ' (concluído)' ELSE ' (desmarcado)' END,
            jsonb_build_object('item_id', _item_id, 'checked', _checked));
  PERFORM public.log_audit('service_orders','checklist_update', v_item.service_order_id, NULL,
    jsonb_build_object('item_id', _item_id, 'checked', _checked));
  RETURN v_item;
END $$;
REVOKE EXECUTE ON FUNCTION public.so_checklist_toggle(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_checklist_toggle(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_checklist_add_item(_so_id uuid, _title text, _description text DEFAULT NULL, _required boolean DEFAULT false)
RETURNS public.service_order_checklist_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.service_order_checklist_items; v_so public.service_orders; v_next int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'Título é obrigatório.'; END IF;
  SELECT * INTO v_so FROM public.service_orders WHERE id = _so_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  IF NOT public.so_can_mutate_execution(_so_id) THEN
    RAISE EXCEPTION 'Você não pode alterar o checklist desta OS no momento.';
  END IF;
  SELECT COALESCE(MAX(sort_order),0)+1 INTO v_next FROM public.service_order_checklist_items WHERE service_order_id = _so_id;
  INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, description, required, sort_order)
    VALUES (v_so.company_id, _so_id, trim(_title), NULLIF(trim(coalesce(_description,'')),''), coalesce(_required,false), v_next)
    RETURNING * INTO v_item;
  INSERT INTO public.service_order_execution_logs(company_id, service_order_id, user_id, action, notes, metadata)
    VALUES (v_so.company_id, _so_id, auth.uid(), 'CHECKLIST_ITEM_ADDED', v_item.title,
            jsonb_build_object('item_id', v_item.id, 'required', v_item.required));
  PERFORM public.log_audit('service_orders','checklist_item_add', _so_id, NULL,
    jsonb_build_object('item_id', v_item.id, 'title', v_item.title));
  RETURN v_item;
END $$;
REVOKE EXECUTE ON FUNCTION public.so_checklist_add_item(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_checklist_add_item(uuid, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_photo_register(
  _so_id uuid, _photo_type text, _file_url text, _file_name text,
  _file_size integer DEFAULT NULL, _description text DEFAULT NULL
)
RETURNS public.service_order_photos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_so public.service_orders; v_row public.service_order_photos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF _photo_type NOT IN ('BEFORE','DURING','AFTER','PROBLEM','MATERIAL','OTHER') THEN
    RAISE EXCEPTION 'Tipo de foto inválido.';
  END IF;
  SELECT * INTO v_so FROM public.service_orders WHERE id = _so_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  IF NOT public.so_can_mutate_execution(_so_id) THEN
    RAISE EXCEPTION 'Não é possível adicionar fotos nesta OS no momento.';
  END IF;
  INSERT INTO public.service_order_photos(company_id, service_order_id, photo_type, file_url, file_name, file_size, description, uploaded_by)
    VALUES (v_so.company_id, _so_id, _photo_type, _file_url, _file_name, _file_size, _description, auth.uid())
    RETURNING * INTO v_row;
  INSERT INTO public.service_order_execution_logs(company_id, service_order_id, user_id, action, notes, metadata)
    VALUES (v_so.company_id, _so_id, auth.uid(), 'PHOTO_ADDED', _photo_type, jsonb_build_object('photo_id', v_row.id));
  PERFORM public.log_audit('service_orders','photo_add', _so_id, NULL,
    jsonb_build_object('photo_id', v_row.id, 'photo_type', _photo_type));
  PERFORM public.notify_user(auth.uid(), v_so.company_id, 'Foto adicionada à OS',
    format('Nova foto (%s) na OS %s.', _photo_type, v_so.service_order_number));
  RETURN v_row;
END $$;
REVOKE EXECUTE ON FUNCTION public.so_photo_register(uuid, text, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_photo_register(uuid, text, text, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_photo_delete(_photo_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_photo public.service_order_photos; v_can boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_photo FROM public.service_order_photos WHERE id = _photo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Foto não encontrada.'; END IF;
  IF v_photo.company_id <> public.current_company_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem acesso a esta foto.';
  END IF;
  v_can := public.is_super_admin() OR public.has_company_role('owner')
           OR public.has_permission('service_orders.delete_photos')
           OR (v_photo.uploaded_by = auth.uid() AND public.so_can_mutate_execution(v_photo.service_order_id));
  IF NOT v_can THEN RAISE EXCEPTION 'Sem permissão para excluir esta foto.'; END IF;
  DELETE FROM public.service_order_photos WHERE id = _photo_id;
  INSERT INTO public.service_order_execution_logs(company_id, service_order_id, user_id, action, notes, metadata)
    VALUES (v_photo.company_id, v_photo.service_order_id, auth.uid(), 'PHOTO_REMOVED', v_photo.photo_type,
            jsonb_build_object('photo_id', _photo_id));
  PERFORM public.log_audit('service_orders','photo_delete', v_photo.service_order_id, NULL,
    jsonb_build_object('photo_id', _photo_id));
  RETURN v_photo.file_url;
END $$;
REVOKE EXECUTE ON FUNCTION public.so_photo_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_photo_delete(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_pending_required_checklist(_so_id uuid)
RETURNS SETOF public.service_order_checklist_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.service_order_checklist_items
  WHERE service_order_id = _so_id
    AND required = true
    AND checked = false
    AND (company_id = public.current_company_id() OR public.is_super_admin())
  ORDER BY sort_order, created_at;
$$;
REVOKE EXECUTE ON FUNCTION public.so_pending_required_checklist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_pending_required_checklist(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_material_add(
  _so_id uuid, _item_id uuid, _used_quantity numeric,
  _location_id uuid, _so_item_id uuid DEFAULT NULL, _notes text DEFAULT NULL
)
RETURNS public.service_order_material_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_so public.service_orders;
  v_row public.service_order_material_usage;
  v_item record; v_avail numeric := 0; v_warn boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF _used_quantity IS NULL OR _used_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero.'; END IF;
  IF _location_id IS NULL THEN RAISE EXCEPTION 'Local de estoque é obrigatório.'; END IF;
  SELECT * INTO v_so FROM public.service_orders WHERE id = _so_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  IF NOT public.so_can_mutate_execution(_so_id) THEN
    RAISE EXCEPTION 'Não é possível registrar material nesta OS no momento.';
  END IF;
  SELECT company_id, item_type::text AS item_type, controls_stock, unit::text AS unit, name
    INTO v_item FROM public.items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.'; END IF;
  IF v_item.company_id <> v_so.company_id THEN RAISE EXCEPTION 'Produto de outra empresa.'; END IF;
  IF v_item.item_type = 'SERVICE' THEN RAISE EXCEPTION 'Serviços não podem ser registrados como material.'; END IF;
  IF NOT COALESCE(v_item.controls_stock,false) THEN RAISE EXCEPTION 'Item não controla estoque.'; END IF;

  SELECT COALESCE(quantity,0) INTO v_avail FROM public.stock_balances
    WHERE item_id = _item_id AND location_id = _location_id;
  v_warn := _used_quantity > COALESCE(v_avail,0);

  INSERT INTO public.service_order_material_usage(
    company_id, service_order_id, item_id, service_order_item_id, stock_location_id,
    planned_quantity, used_quantity, unit, notes, stock_warning, created_by
  ) VALUES (
    v_so.company_id, _so_id, _item_id, _so_item_id, _location_id,
    COALESCE((SELECT planned_quantity FROM public.service_order_items WHERE id = _so_item_id), 0),
    _used_quantity, v_item.unit, _notes, v_warn, auth.uid()
  ) RETURNING * INTO v_row;

  INSERT INTO public.service_order_execution_logs(company_id, service_order_id, user_id, action, notes, metadata)
    VALUES (v_so.company_id, _so_id, auth.uid(),
            CASE WHEN v_warn THEN 'MATERIAL_STOCK_WARNING' ELSE 'MATERIAL_ADDED' END,
            v_item.name || ' (' || _used_quantity || ' ' || COALESCE(v_item.unit,'') || ')',
            jsonb_build_object('material_id', v_row.id, 'item_id', _item_id, 'used_quantity', _used_quantity, 'available', v_avail, 'stock_warning', v_warn));
  PERFORM public.log_audit('service_orders','material_add', _so_id, NULL,
    jsonb_build_object('material_id', v_row.id, 'item_id', _item_id, 'quantity', _used_quantity, 'stock_warning', v_warn));
  IF v_warn THEN
    PERFORM public.notify_user(auth.uid(), v_so.company_id, 'Material acima do saldo',
      format('Material utilizado acima do saldo disponível na OS %s.', v_so.service_order_number));
  END IF;
  RETURN v_row;
END $$;
REVOKE EXECUTE ON FUNCTION public.so_material_add(uuid, uuid, numeric, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_material_add(uuid, uuid, numeric, uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_material_update(
  _id uuid, _used_quantity numeric, _location_id uuid DEFAULT NULL, _notes text DEFAULT NULL
)
RETURNS public.service_order_material_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.service_order_material_usage; v_avail numeric; v_warn boolean; v_loc uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF _used_quantity IS NULL OR _used_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero.'; END IF;
  SELECT * INTO v_row FROM public.service_order_material_usage WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  IF NOT public.so_can_mutate_execution(v_row.service_order_id) THEN
    RAISE EXCEPTION 'Não é possível alterar materiais desta OS no momento.';
  END IF;
  v_loc := COALESCE(_location_id, v_row.stock_location_id);
  IF v_loc IS NULL THEN RAISE EXCEPTION 'Local de estoque é obrigatório.'; END IF;
  SELECT COALESCE(quantity,0) INTO v_avail FROM public.stock_balances
    WHERE item_id = v_row.item_id AND location_id = v_loc;
  v_warn := _used_quantity > COALESCE(v_avail,0);
  UPDATE public.service_order_material_usage SET
    used_quantity = _used_quantity,
    stock_location_id = v_loc,
    notes = COALESCE(_notes, notes),
    stock_warning = v_warn,
    updated_at = now()
  WHERE id = _id RETURNING * INTO v_row;
  INSERT INTO public.service_order_execution_logs(company_id, service_order_id, user_id, action, notes, metadata)
    VALUES (v_row.company_id, v_row.service_order_id, auth.uid(),
            CASE WHEN v_warn THEN 'MATERIAL_STOCK_WARNING' ELSE 'MATERIAL_UPDATED' END,
            'Atualização de material',
            jsonb_build_object('material_id', _id, 'used_quantity', _used_quantity, 'available', v_avail, 'stock_warning', v_warn));
  PERFORM public.log_audit('service_orders','material_update', v_row.service_order_id, NULL,
    jsonb_build_object('material_id', _id, 'quantity', _used_quantity, 'stock_warning', v_warn));
  RETURN v_row;
END $$;
REVOKE EXECUTE ON FUNCTION public.so_material_update(uuid, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_material_update(uuid, numeric, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.so_check_stock(_item_id uuid, _location_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(quantity,0)::numeric FROM public.stock_balances
  WHERE item_id = _item_id AND location_id = _location_id
    AND (company_id = public.current_company_id() OR public.is_super_admin())
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.so_check_stock(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_check_stock(uuid, uuid) TO authenticated;
