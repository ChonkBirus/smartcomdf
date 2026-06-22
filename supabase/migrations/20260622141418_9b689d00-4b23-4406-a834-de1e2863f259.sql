
-- Quotes module — Phase 2.4 Part A (base)

CREATE TYPE public.quote_status AS ENUM (
  'DRAFT','SENT','VIEWED','APPROVED','REJECTED','CANCELLED','EXPIRED'
);

CREATE TYPE public.quote_item_kind AS ENUM ('PRODUCT','SERVICE','LABOR','OTHER');

-- ============================================================
-- QUOTES
-- ============================================================
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_number TEXT NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'DRAFT',
  title TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  payment_terms TEXT,
  delivery_terms TEXT,
  warranty_terms TEXT,
  completion_estimate TEXT,
  customer_notes TEXT,
  internal_notes TEXT,
  labor_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  items_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quotes_number_per_company UNIQUE (company_id, quote_number)
);

CREATE INDEX idx_quotes_company ON public.quotes(company_id);
CREATE INDEX idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX idx_quotes_status ON public.quotes(company_id, status);
CREATE INDEX idx_quotes_issue ON public.quotes(company_id, issue_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON public.quotes FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('quotes.view') OR public.has_permission('quotes.manage'))
  );

CREATE POLICY "quotes_insert" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('quotes.create') OR public.has_permission('quotes.manage'))
  );

CREATE POLICY "quotes_update" ON public.quotes FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('quotes.edit') OR public.has_permission('quotes.manage'))
  )
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "quotes_delete" ON public.quotes FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('quotes.delete') OR public.has_permission('quotes.manage'))
  );

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- QUOTE ITEMS
-- ============================================================
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  kind public.quote_item_kind NOT NULL DEFAULT 'PRODUCT',
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX idx_quote_items_company ON public.quote_items(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_items_all" ON public.quote_items FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('quotes.view') OR public.has_permission('quotes.manage'))
  )
  WITH CHECK (company_id = public.current_company_id());

CREATE TRIGGER quote_items_set_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Compute item total and recalc quote totals
CREATE OR REPLACE FUNCTION public.quote_items_compute_total()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.total := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  RETURN NEW;
END $$;

CREATE TRIGGER quote_items_compute_total_trg
  BEFORE INSERT OR UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.quote_items_compute_total();

CREATE OR REPLACE FUNCTION public.quote_recalc_totals(_quote_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  subt NUMERIC(14,2);
  lc NUMERIC(14,2);
  disc NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(total),0) INTO subt
    FROM public.quote_items WHERE quote_id = _quote_id;
  SELECT labor_cost, discount INTO lc, disc
    FROM public.quotes WHERE id = _quote_id;
  UPDATE public.quotes
    SET items_subtotal = subt,
        total_amount = GREATEST(0, ROUND(subt + COALESCE(lc,0) - COALESCE(disc,0), 2)),
        updated_at = now()
    WHERE id = _quote_id;
END $$;

CREATE OR REPLACE FUNCTION public.quote_items_after_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE qid UUID;
BEGIN
  qid := COALESCE(NEW.quote_id, OLD.quote_id);
  PERFORM public.quote_recalc_totals(qid);
  RETURN NULL;
END $$;

CREATE TRIGGER quote_items_recalc_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.quote_items_after_change();

CREATE OR REPLACE FUNCTION public.quotes_recalc_on_quote_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.labor_cost IS DISTINCT FROM OLD.labor_cost
     OR NEW.discount IS DISTINCT FROM OLD.discount THEN
    NEW.total_amount := GREATEST(0, ROUND(COALESCE(NEW.items_subtotal,0) + COALESCE(NEW.labor_cost,0) - COALESCE(NEW.discount,0), 2));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER quotes_recalc_on_change_trg
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_recalc_on_quote_change();

-- ============================================================
-- QUOTE NUMBER GENERATOR (per company sequence "ORC-YYYY-NNNN")
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_quote_number(_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr TEXT := to_char(now(), 'YYYY');
  prefix TEXT := 'ORC-' || yr || '-';
  next_seq INT;
  num TEXT;
BEGIN
  SELECT COALESCE(MAX(
           NULLIF(regexp_replace(quote_number, '^' || prefix, ''), '')::INT
         ), 0) + 1
    INTO next_seq
    FROM public.quotes
    WHERE company_id = _company_id
      AND quote_number ~ ('^' || prefix || '[0-9]+$');
  num := prefix || lpad(next_seq::TEXT, 4, '0');
  RETURN num;
END $$;

-- ============================================================
-- EXPIRE OUTDATED QUOTES (manual call helper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.quotes_mark_expired()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c INTEGER;
BEGIN
  UPDATE public.quotes
    SET status = 'EXPIRED', updated_at = now()
    WHERE valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE
      AND status IN ('DRAFT','SENT','VIEWED');
  GET DIAGNOSTICS c = ROW_COUNT;
  RETURN c;
END $$;

-- ============================================================
-- AUDIT TRIGGER ON STATUS CHANGE
-- ============================================================
CREATE OR REPLACE FUNCTION public.quotes_audit_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_audit('quotes', 'status_change', NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER quotes_audit_status_trg
  AFTER UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_audit_status();
