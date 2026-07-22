DO $$
DECLARE
  v_rows integer;
  v_already_canceled boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.financial_transactions
    WHERE id = 'bc43b33b-ef1f-4ffd-910a-0dd80dbd2696'
      AND quote_id = 'a35d9014-b467-4b44-b7c3-1ae3e79f9c12'
      AND status = 'CANCELED'
      AND deleted_at IS NULL
  )
  INTO v_already_canceled;

  UPDATE public.financial_transactions
  SET
    status = 'CANCELED',
    notes = concat_ws(
      E'\n',
      NULLIF(notes, ''),
      '[HOTFIX 2026-07-22] Cancelado por duplicidade com o fluxo canônico QUOTE_PAYMENT + QUOTE_RECEIVABLE_BALANCE do orçamento ORC-2026-0004.'
    ),
    updated_at = now()
  WHERE id = 'bc43b33b-ef1f-4ffd-910a-0dd80dbd2696'
    AND quote_id = 'a35d9014-b467-4b44-b7c3-1ae3e79f9c12'
    AND company_id = (
      SELECT company_id FROM public.quotes WHERE id = 'a35d9014-b467-4b44-b7c3-1ae3e79f9c12'
    )
    AND project_id IS NOT DISTINCT FROM (
      SELECT project_id FROM public.quotes WHERE id = 'a35d9014-b467-4b44-b7c3-1ae3e79f9c12'
    )
    AND type = 'INCOME'
    AND amount = 1531.71
    AND status = 'PLANNED'
    AND origin_type IS NULL
    AND description = 'Recebível do orçamento'
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 1 THEN
    RAISE EXCEPTION 'Hotfix interrompido: mais de uma transação foi alterada.';
  END IF;

  IF v_rows = 0 AND NOT v_already_canceled THEN
    RAISE EXCEPTION 'Hotfix interrompido: a transação não corresponde aos critérios esperados.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_transactions
    WHERE quote_id = 'a35d9014-b467-4b44-b7c3-1ae3e79f9c12'
      AND origin_type = 'QUOTE_PAYMENT'
      AND type = 'INCOME'
      AND amount = 765.86
      AND status = 'PAID'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Hotfix interrompido: QUOTE_PAYMENT canônico não encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_transactions
    WHERE quote_id = 'a35d9014-b467-4b44-b7c3-1ae3e79f9c12'
      AND origin_type = 'QUOTE_RECEIVABLE_BALANCE'
      AND type = 'INCOME'
      AND amount = 765.85
      AND status = 'PLANNED'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Hotfix interrompido: saldo canônico não encontrado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_transactions
    WHERE quote_id = 'a35d9014-b467-4b44-b7c3-1ae3e79f9c12'
      AND type = 'INCOME'
      AND origin_type IS NULL
      AND status <> 'CANCELED'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Hotfix interrompido: ainda existe recebível legado ativo.';
  END IF;
END
$$;