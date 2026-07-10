CREATE OR REPLACE FUNCTION public.mark_purchase_order_paid(_po_id uuid, _bank_account_id uuid DEFAULT NULL::uuid, _payment_method text DEFAULT NULL::text, _paid_at timestamp with time zone DEFAULT now(), _notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  po public.purchase_orders%ROWTYPE;
  v_tx_id uuid;
  v_allowed boolean;
BEGIN
  SELECT * INTO po FROM public.purchase_orders WHERE id = _po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra não encontrado'; END IF;

  v_allowed := public.is_super_admin()
    OR public.has_company_role('owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_permission('finance.manage')
    OR public.has_permission('finance.payables.manage')
    OR public.has_permission('purchases.manage')
    OR public.has_permission('purchases.pay');
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para marcar pedido de compra como pago';
  END IF;

  IF public.current_company_id() IS DISTINCT FROM po.company_id
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Pedido pertence a outra empresa';
  END IF;

  IF _bank_account_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_bank_accounts
       WHERE id = _bank_account_id
         AND company_id = po.company_id
         AND COALESCE(active, true) = true
    ) THEN
      RAISE EXCEPTION 'Conta financeira inválida para esta empresa';
    END IF;
  END IF;

  v_tx_id := public.sync_purchase_order_to_finance(_po_id);
  IF v_tx_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível sincronizar pedido ao financeiro (status: %)', po.status;
  END IF;

  UPDATE public.financial_transactions SET
    status = 'PAID',
    paid_at = COALESCE(_paid_at, now()),
    bank_account_id = COALESCE(_bank_account_id, bank_account_id),
    payment_method = COALESCE(_payment_method, payment_method),
    notes = COALESCE(_notes, notes),
    updated_at = now()
  WHERE id = v_tx_id;

  RETURN v_tx_id;
END; $function$;