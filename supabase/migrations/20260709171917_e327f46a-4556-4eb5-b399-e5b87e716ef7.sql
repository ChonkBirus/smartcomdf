
CREATE OR REPLACE FUNCTION public.trg_prevent_duplicate_stock_os_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Só atua em despesas oriundas de estoque ou OS
  IF NEW.type <> 'EXPENSE' OR NEW.origin_type IS NULL
     OR NEW.origin_type NOT IN ('STOCK_PURCHASE','SERVICE_ORDER_COST') THEN
    RETURN NEW;
  END IF;

  -- 1) Já existe conta a pagar do PR4 para o mesmo pedido de compra?
  IF NEW.purchase_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.financial_transactions
       WHERE company_id = NEW.company_id
         AND deleted_at IS NULL
         AND status <> 'CANCELED'
         AND (
           (origin_type = 'PURCHASE_ORDER_PAYABLE' AND origin_id = NEW.purchase_id)
           OR (type = 'EXPENSE' AND purchase_id = NEW.purchase_id
               AND (origin_type IS NULL OR origin_type <> NEW.origin_type OR origin_id IS DISTINCT FROM NEW.origin_id))
         )
    ) INTO v_exists;
    IF v_exists THEN
      RAISE NOTICE 'Ignorando % duplicado: já existe despesa financeira para purchase_id=%',
        NEW.origin_type, NEW.purchase_id;
      RETURN NULL;
    END IF;
  END IF;

  -- 2) OS: já existe despesa vinculada à mesma OS (inclui PR4 se o PO estiver ligado à OS)?
  IF NEW.service_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.financial_transactions ft
       WHERE ft.company_id = NEW.company_id
         AND ft.deleted_at IS NULL
         AND ft.status <> 'CANCELED'
         AND ft.type = 'EXPENSE'
         AND (
           ft.service_order_id = NEW.service_order_id
           OR (ft.origin_type = 'PURCHASE_ORDER_PAYABLE'
               AND EXISTS (
                 SELECT 1 FROM public.purchase_orders po
                  WHERE po.id = ft.origin_id
                    AND po.service_order_id = NEW.service_order_id
               ))
         )
         AND (ft.origin_type IS DISTINCT FROM NEW.origin_type
              OR ft.origin_id IS DISTINCT FROM NEW.origin_id)
    ) INTO v_exists;
    IF v_exists THEN
      RAISE NOTICE 'Ignorando % duplicado: já existe despesa financeira para service_order_id=%',
        NEW.origin_type, NEW.service_order_id;
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_stock_os_expense ON public.financial_transactions;
CREATE TRIGGER trg_prevent_duplicate_stock_os_expense
BEFORE INSERT ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_duplicate_stock_os_expense();
