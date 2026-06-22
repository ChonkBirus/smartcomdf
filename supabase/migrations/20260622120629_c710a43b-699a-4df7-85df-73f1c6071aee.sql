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
  raw_unit_text TEXT;
  mapped_unit public.product_unit;
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
      raw_unit_text := UPPER(TRIM(COALESCE(NULLIF(payload->>'unit', ''), itm.raw_unit, 'UN')));
      mapped_unit := CASE raw_unit_text
        WHEN 'UN' THEN 'UN'::public.product_unit
        WHEN 'PC' THEN 'UN'::public.product_unit
        WHEN 'PÇ' THEN 'UN'::public.product_unit
        WHEN 'PCS' THEN 'UN'::public.product_unit
        WHEN 'UND' THEN 'UN'::public.product_unit
        WHEN 'UNID' THEN 'UN'::public.product_unit
        WHEN 'CX' THEN 'CX'::public.product_unit
        WHEN 'CAIXA' THEN 'CX'::public.product_unit
        WHEN 'M' THEN 'MT'::public.product_unit
        WHEN 'MT' THEN 'MT'::public.product_unit
        WHEN 'METRO' THEN 'MT'::public.product_unit
        WHEN 'M2' THEN 'M2'::public.product_unit
        WHEN 'M²' THEN 'M2'::public.product_unit
        WHEN 'M3' THEN 'M3'::public.product_unit
        WHEN 'M³' THEN 'M3'::public.product_unit
        WHEN 'RL' THEN 'RL'::public.product_unit
        WHEN 'ROLO' THEN 'RL'::public.product_unit
        WHEN 'KIT' THEN 'KIT'::public.product_unit
        ELSE 'UN'::public.product_unit
      END;

      INSERT INTO public.items (
        company_id, name, sku, unit, item_type, controls_stock,
        cost_price, sale_price, active, minimum_stock
      ) VALUES (
        cid,
        COALESCE(payload->>'name', itm.raw_name),
        NULLIF(payload->>'sku', ''),
        mapped_unit,
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