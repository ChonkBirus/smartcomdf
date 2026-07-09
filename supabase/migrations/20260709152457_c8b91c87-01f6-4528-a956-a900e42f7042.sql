
-- PR4: Purchase Order -> Financeiro (integração cash flow)

-- 1) Ampliar CHECK de origin_type
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_origin_type_chk;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_origin_type_chk
  CHECK (origin_type IS NULL OR origin_type = ANY (ARRAY[
    'QUOTE_PAYMENT','QUOTE_RECEIVABLE_BALANCE','QUOTE','MANUAL','PURCHASE',
    'SERVICE_ORDER','OPEN_FINANCE','IMPORT','PAYMENT',
    'PURCHASE_ORDER_PAYABLE','PURCHASE_ORDER_PAYMENT','PURCHASE_ORDER_PAYABLE_BALANCE',
    'STOCK_PURCHASE','SERVICE_ORDER_COST'
  ]));

-- 2) Helper: resolver categoria "Fornecedores" (fallback: Compra de equipamentos, senão qualquer EXPENSE)
CREATE OR REPLACE FUNCTION public._po_expense_category(_company uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.financial_categories
   WHERE company_id = _company AND type = 'EXPENSE'
   ORDER BY
     CASE WHEN name ILIKE 'fornecedor%' THEN 0
          WHEN name ILIKE 'compra de equipamento%' THEN 1
          WHEN name ILIKE 'compra%' THEN 2
          ELSE 9 END,
     name
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public._po_expense_category(uuid) FROM public;

-- 3) sync_purchase_order_to_finance (interna; sem GRANT p/ authenticated)
CREATE OR REPLACE FUNCTION public.sync_purchase_order_to_finance(_po_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  po public.purchase_orders%ROWTYPE;
  v_tx_id uuid;
  v_cat uuid;
  v_desc text;
BEGIN
  SELECT * INTO po FROM public.purchase_orders WHERE id = _po_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Só cria/atualiza para status "vivos"
  IF po.status NOT IN ('APPROVED','PARTIALLY_RECEIVED','RECEIVED') THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_tx_id FROM public.financial_transactions
   WHERE company_id = po.company_id
     AND origin_type = 'PURCHASE_ORDER_PAYABLE'
     AND origin_id = po.id
     AND deleted_at IS NULL
   LIMIT 1;

  -- Não altera automaticamente registros já pagos
  IF v_tx_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE id = v_tx_id AND status = 'PAID') THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  v_cat := public._po_expense_category(po.company_id);
  v_desc := 'Pedido de compra ' || COALESCE(po.order_number, po.id::text);

  IF v_tx_id IS NULL THEN
    INSERT INTO public.financial_transactions(
      company_id, type, category_id, description, amount,
      due_date, status, supplier_id, purchase_id, origin,
      origin_type, origin_id, created_by
    ) VALUES (
      po.company_id, 'EXPENSE', v_cat, v_desc, COALESCE(po.total_amount,0),
      COALESCE(po.expected_delivery_date, po.issue_date, CURRENT_DATE),
      'PLANNED', po.supplier_id, po.id, 'PURCHASE',
      'PURCHASE_ORDER_PAYABLE', po.id, COALESCE(po.approved_by, po.created_by)
    ) RETURNING id INTO v_tx_id;
  ELSE
    UPDATE public.financial_transactions SET
      amount = COALESCE(po.total_amount,0),
      due_date = COALESCE(po.expected_delivery_date, po.issue_date, due_date),
      supplier_id = po.supplier_id,
      description = v_desc,
      status = CASE WHEN status = 'CANCELED' THEN 'PLANNED' ELSE status END,
      updated_at = now()
    WHERE id = v_tx_id;
  END IF;

  RETURN v_tx_id;
END; $$;
REVOKE ALL ON FUNCTION public.sync_purchase_order_to_finance(uuid) FROM public;

-- 4) cancel_purchase_order_finance (interna)
CREATE OR REPLACE FUNCTION public.cancel_purchase_order_finance(_po_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.financial_transactions
     SET status = 'CANCELED', updated_at = now()
   WHERE origin_type = 'PURCHASE_ORDER_PAYABLE'
     AND origin_id = _po_id
     AND deleted_at IS NULL
     AND status <> 'PAID';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.cancel_purchase_order_finance(uuid) FROM public;

-- 5) mark_purchase_order_paid (ação de usuário; permissões restritas)
CREATE OR REPLACE FUNCTION public.mark_purchase_order_paid(
  _po_id uuid,
  _bank_account_id uuid DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _paid_at timestamptz DEFAULT now(),
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  po public.purchase_orders%ROWTYPE;
  v_tx_id uuid;
  v_allowed boolean;
BEGIN
  SELECT * INTO po FROM public.purchase_orders WHERE id = _po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra não encontrado'; END IF;

  -- Permissões: owner/admin OU permissões de finanças/compras específicas
  v_allowed := public.is_super_admin()
    OR public.has_company_role('owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_permission('finance.manage')
    OR public.has_permission('finance.payables.manage')
    OR public.has_permission('purchases.manage')
    OR public.has_permission('purchases.pay');
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para marcar pedido de compra como pago';
  END IF;

  -- Isolamento multiempresa
  IF public.current_company_id() IS DISTINCT FROM po.company_id
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Pedido pertence a outra empresa';
  END IF;

  -- Validação da conta bancária
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

  -- Garante a transação PLANNED
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
END; $$;
REVOKE ALL ON FUNCTION public.mark_purchase_order_paid(uuid, uuid, text, timestamptz, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_purchase_order_paid(uuid, uuid, text, timestamptz, text) TO authenticated;

-- 6) Trigger em purchase_orders
CREATE OR REPLACE FUNCTION public.trg_purchase_order_finance_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('APPROVED','PARTIALLY_RECEIVED','RECEIVED') THEN
      PERFORM public.sync_purchase_order_to_finance(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
    PERFORM public.cancel_purchase_order_finance(NEW.id);
  ELSIF NEW.status IN ('APPROVED','PARTIALLY_RECEIVED','RECEIVED')
        AND (OLD.status IS DISTINCT FROM NEW.status
             OR OLD.total_amount IS DISTINCT FROM NEW.total_amount
             OR OLD.expected_delivery_date IS DISTINCT FROM NEW.expected_delivery_date
             OR OLD.supplier_id IS DISTINCT FROM NEW.supplier_id) THEN
    PERFORM public.sync_purchase_order_to_finance(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_purchase_order_finance_sync ON public.purchase_orders;
CREATE TRIGGER trg_purchase_order_finance_sync
AFTER INSERT OR UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_purchase_order_finance_sync();

-- 7) Backfill idempotente (só PLANNED; não marca PAID)
DO $$
DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.purchase_orders
           WHERE status IN ('APPROVED','PARTIALLY_RECEIVED','RECEIVED')
  LOOP
    PERFORM public.sync_purchase_order_to_finance(r.id);
  END LOOP;
END $$;
