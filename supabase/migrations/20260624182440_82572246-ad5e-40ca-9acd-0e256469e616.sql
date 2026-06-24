
-- Extend execution log action enum to include STOCK_DEDUCTED
ALTER TABLE public.service_order_execution_logs
  DROP CONSTRAINT IF EXISTS service_order_execution_logs_action_check;
ALTER TABLE public.service_order_execution_logs
  ADD CONSTRAINT service_order_execution_logs_action_check
  CHECK (action IN (
    'STARTED','PAUSED','RESUMED','CHECKLIST_UPDATED','PHOTO_ADDED',
    'MATERIAL_ADDED','MATERIAL_UPDATED','NOTE_ADDED','FINISHED_EXECUTION',
    'SIGNATURE_COLLECTED','STOCK_DEDUCTED'
  ));

-- ============================================================
-- so_deduct_stock(_so_id uuid) -> jsonb summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.so_deduct_stock(_so_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  so_row public.service_orders;
  mu RECORD;
  prev_bal NUMERIC;
  new_bal NUMERIC;
  mov_id UUID;
  total INT := 0;
  ok_cnt INT := 0;
  blocked_cnt INT := 0;
  failed_cnt INT := 0;
  skipped_cnt INT := 0;
  final_status TEXT;
  log_status TEXT;
  log_err TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT public.can_access_service_order(_so_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta OS.';
  END IF;
  IF NOT public.has_permission('service_orders.deduct_stock') THEN
    RAISE EXCEPTION 'Sem permissão para baixa de estoque.';
  END IF;

  SELECT * INTO so_row FROM public.service_orders WHERE id = _so_id FOR UPDATE;
  IF so_row.id IS NULL THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  cid := so_row.company_id;

  IF so_row.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'A OS precisa estar concluída para baixar estoque.';
  END IF;
  IF so_row.stock_deduction_status = 'DEDUCTED' THEN
    RAISE EXCEPTION 'Baixa de estoque já realizada.';
  END IF;
  IF so_row.stock_deduction_status = 'NOT_APPLICABLE' THEN
    RAISE EXCEPTION 'Esta OS não possui materiais para baixa.';
  END IF;

  FOR mu IN
    SELECT u.id, u.item_id, u.stock_location_id, u.used_quantity,
           i.controls_stock, i.item_type, i.name AS item_name
    FROM public.service_order_material_usage u
    JOIN public.items i ON i.id = u.item_id
    WHERE u.service_order_id = _so_id
      AND u.used_quantity > 0
  LOOP
    total := total + 1;
    log_status := NULL; log_err := NULL; mov_id := NULL;

    -- Skip non-stockable
    IF mu.item_type <> 'PRODUCT' OR NOT COALESCE(mu.controls_stock, FALSE) THEN
      skipped_cnt := skipped_cnt + 1;
      CONTINUE;
    END IF;

    IF mu.stock_location_id IS NULL THEN
      failed_cnt := failed_cnt + 1;
      log_status := 'FAILED'; log_err := 'Sem local de estoque definido.';
    ELSE
      -- Lock balance row
      INSERT INTO public.stock_balances (company_id, item_id, location_id, quantity)
        VALUES (cid, mu.item_id, mu.stock_location_id, 0)
        ON CONFLICT (item_id, location_id) DO NOTHING;

      SELECT quantity INTO prev_bal FROM public.stock_balances
        WHERE item_id = mu.item_id AND location_id = mu.stock_location_id FOR UPDATE;

      IF prev_bal < mu.used_quantity THEN
        blocked_cnt := blocked_cnt + 1;
        log_status := 'BLOCKED';
        log_err := format('Saldo insuficiente (disp. %s, solic. %s).', prev_bal, mu.used_quantity);
      ELSE
        new_bal := prev_bal - mu.used_quantity;
        UPDATE public.stock_balances SET quantity = new_bal, updated_at = now()
          WHERE item_id = mu.item_id AND location_id = mu.stock_location_id;

        INSERT INTO public.stock_movements
          (company_id, item_id, location_id, movement_type, quantity,
           previous_balance, new_balance, reason, notes,
           reference_type, reference_id, user_id)
          VALUES (cid, mu.item_id, mu.stock_location_id, 'EXIT', mu.used_quantity,
                  prev_bal, new_bal,
                  'OS_' || so_row.service_order_number,
                  'Baixa automática da OS ' || so_row.service_order_number,
                  'service_order', _so_id, uid)
          RETURNING id INTO mov_id;

        ok_cnt := ok_cnt + 1;
        log_status := 'DEDUCTED';
      END IF;
    END IF;

    INSERT INTO public.service_order_stock_deduction_logs
      (company_id, service_order_id, material_usage_id, item_id, stock_location_id,
       quantity, stock_movement_id, status, error_message, created_by)
      VALUES (cid, _so_id, mu.id, mu.item_id, mu.stock_location_id,
              mu.used_quantity, mov_id, log_status, log_err, uid);
  END LOOP;

  -- Determine final status
  IF total = 0 OR (skipped_cnt = total AND ok_cnt = 0 AND blocked_cnt = 0 AND failed_cnt = 0) THEN
    final_status := 'NOT_APPLICABLE';
  ELSIF blocked_cnt = 0 AND failed_cnt = 0 THEN
    final_status := 'DEDUCTED';
  ELSE
    final_status := 'BLOCKED';
  END IF;

  UPDATE public.service_orders
    SET stock_deduction_status = final_status,
        stock_deducted_at = CASE WHEN final_status = 'DEDUCTED' THEN now() ELSE stock_deducted_at END,
        stock_deducted_by = CASE WHEN final_status = 'DEDUCTED' THEN uid ELSE stock_deducted_by END,
        updated_at = now()
    WHERE id = _so_id;

  -- Execution log + audit + activity
  INSERT INTO public.service_order_execution_logs (company_id, service_order_id, user_id, action, notes)
    VALUES (cid, _so_id, uid, 'STOCK_DEDUCTED',
            format('Baixa: %s ok, %s bloqueados, %s falhas, %s ignorados.',
                   ok_cnt, blocked_cnt, failed_cnt, skipped_cnt));

  PERFORM public.log_audit('service_orders', 'deduct_stock', _so_id, NULL,
    jsonb_build_object('status', final_status,
                       'ok', ok_cnt, 'blocked', blocked_cnt,
                       'failed', failed_cnt, 'skipped', skipped_cnt));
  PERFORM public.log_activity(format('OS %s — baixa de estoque %s.', so_row.service_order_number, final_status));

  RETURN jsonb_build_object(
    'status', final_status,
    'total', total,
    'deducted', ok_cnt,
    'blocked', blocked_cnt,
    'failed', failed_cnt,
    'skipped', skipped_cnt
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.so_deduct_stock(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_deduct_stock(UUID) TO authenticated;
