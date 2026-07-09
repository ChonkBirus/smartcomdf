
CREATE OR REPLACE FUNCTION public.trg_prevent_duplicate_stock_os_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from_stock boolean;
BEGIN
  IF NEW.type <> 'EXPENSE' OR NEW.origin_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Recebimento de estoque nunca lança no financeiro
  IF NEW.origin_type = 'STOCK_PURCHASE' THEN
    RAISE NOTICE 'Ignorando STOCK_PURCHASE: estoque não gera saída financeira (apenas custo).';
    RETURN NULL;
  END IF;

  -- 2) OS: bloqueia quando o custo veio do estoque/pedido de compra.
  --    Permite apenas custos avulsos (sem purchase_id e sem vínculo com stock_movements).
  IF NEW.origin_type = 'SERVICE_ORDER_COST' THEN
    v_from_stock := (NEW.purchase_id IS NOT NULL);

    IF NOT v_from_stock AND NEW.origin_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.stock_movements sm WHERE sm.id = NEW.origin_id
      ) INTO v_from_stock;
    END IF;

    IF NOT v_from_stock AND NEW.service_order_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.stock_movements sm
         WHERE sm.service_order_id = NEW.service_order_id
      ) INTO v_from_stock;
    END IF;

    IF v_from_stock THEN
      RAISE NOTICE 'Ignorando SERVICE_ORDER_COST vindo de estoque/PO: apenas custos avulsos entram no financeiro.';
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END; $$;
