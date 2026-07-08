
-- ============================================================
-- PR1 (retry): drop antigo + recriar RPCs
-- ============================================================
DROP FUNCTION IF EXISTS public.approve_quote_payment(uuid, text);
DROP FUNCTION IF EXISTS public.approve_quote_payment(uuid);
DROP FUNCTION IF EXISTS public.create_project_from_quote(uuid);

-- (colunas / índices / constraints já foram aplicados na migration anterior — reaplicando idempotente)
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS origin_type text,
  ADD COLUMN IF NOT EXISTS origin_id uuid,
  ADD COLUMN IF NOT EXISTS quote_payment_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='financial_transactions_quote_payment_id_fkey') THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_quote_payment_id_fkey
      FOREIGN KEY (quote_payment_id) REFERENCES public.quote_payments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='financial_transactions_origin_type_chk') THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_origin_type_chk
      CHECK (origin_type IS NULL OR origin_type IN (
        'QUOTE_PAYMENT','QUOTE_RECEIVABLE_BALANCE','QUOTE','MANUAL',
        'PURCHASE','SERVICE_ORDER','OPEN_FINANCE','IMPORT','PAYMENT'));
  END IF;
END $$;

DROP INDEX IF EXISTS public.financial_transactions_quote_income_uniq;
DROP INDEX IF EXISTS public.financial_transactions_unique_quote_income;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_origin_uniq
  ON public.financial_transactions (company_id, origin_type, origin_id)
  WHERE origin_type IS NOT NULL AND origin_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fin_tx_origin
  ON public.financial_transactions (origin_type, origin_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'UNPAID';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='quotes_project_id_fkey') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='quotes_project_id_key') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_project_id_key UNIQUE (project_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='quotes_financial_status_chk') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_financial_status_chk
      CHECK (financial_status IN ('UNPAID','PARTIALLY_PAID','PAID'));
  END IF;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'UNPAID';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_financial_status_chk') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_financial_status_chk
      CHECK (financial_status IN ('UNPAID','PARTIALLY_PAID','PAID'));
  END IF;
END $$;

-- ============================================================
-- approve_quote_payment
-- ============================================================
CREATE FUNCTION public.approve_quote_payment(
  _payment_id uuid,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay        public.quote_payments%ROWTYPE;
  v_quote      public.quotes%ROWTYPE;
  v_prof_co    uuid;
  v_paid_sum   numeric(14,2);
  v_remaining  numeric(14,2);
  v_fin_status text;
  v_due        date;
BEGIN
  IF NOT (
    public.has_permission('quote_payments.approve')
    OR public.has_permission('finance.receivables.manage')
    OR public.has_permission('finance.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar pagamento' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_pay FROM public.quote_payments WHERE id=_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;

  SELECT company_id INTO v_prof_co FROM public.profiles WHERE id=auth.uid();
  IF (v_prof_co IS NULL OR v_prof_co <> v_pay.company_id) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem acesso a este pagamento' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id=v_pay.quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  UPDATE public.quote_payments
     SET payment_status='APPROVED',
         approved_by = COALESCE(approved_by, auth.uid()),
         paid_at     = COALESCE(paid_at, now()),
         description = COALESCE(_note, description),
         updated_at  = now()
   WHERE id=_payment_id;

  SELECT * INTO v_pay FROM public.quote_payments WHERE id=_payment_id;

  INSERT INTO public.financial_transactions (
    company_id, type, status, origin, origin_type, origin_id,
    quote_id, quote_payment_id, customer_id, amount, description,
    due_date, paid_at, payment_method, created_by
  ) VALUES (
    v_pay.company_id, 'INCOME', 'PAID', 'QUOTE', 'QUOTE_PAYMENT', v_pay.id,
    v_pay.quote_id, v_pay.id, v_quote.customer_id, v_pay.amount,
    'Pagamento aprovado do orçamento ' || COALESCE(v_quote.quote_number,''),
    COALESCE(v_pay.paid_at::date, CURRENT_DATE),
    COALESCE(v_pay.paid_at, now()),
    v_pay.payment_method, auth.uid()
  )
  ON CONFLICT (company_id, origin_type, origin_id)
  WHERE origin_type IS NOT NULL AND origin_id IS NOT NULL AND deleted_at IS NULL
  DO UPDATE SET
    status         = 'PAID',
    amount         = EXCLUDED.amount,
    paid_at        = EXCLUDED.paid_at,
    payment_method = EXCLUDED.payment_method,
    updated_at     = now();

  SELECT COALESCE(SUM(amount),0) INTO v_paid_sum
    FROM public.quote_payments
   WHERE quote_id=v_pay.quote_id AND payment_status='APPROVED';

  v_remaining := GREATEST(0, COALESCE(v_quote.total_amount,0) - v_paid_sum);
  v_fin_status := CASE
    WHEN v_paid_sum <= 0 THEN 'UNPAID'
    WHEN v_remaining <= 0.005 THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END;

  v_due := COALESCE(v_quote.valid_until, CURRENT_DATE + INTERVAL '30 day')::date;

  IF v_remaining > 0.005 THEN
    INSERT INTO public.financial_transactions (
      company_id, type, status, origin, origin_type, origin_id,
      quote_id, customer_id, amount, description, due_date, created_by
    ) VALUES (
      v_pay.company_id, 'INCOME', 'PLANNED', 'QUOTE', 'QUOTE_RECEIVABLE_BALANCE', v_quote.id,
      v_quote.id, v_quote.customer_id, v_remaining,
      'Saldo restante do orçamento ' || COALESCE(v_quote.quote_number,''),
      v_due, auth.uid()
    )
    ON CONFLICT (company_id, origin_type, origin_id)
    WHERE origin_type IS NOT NULL AND origin_id IS NOT NULL AND deleted_at IS NULL
    DO UPDATE SET
      amount   = EXCLUDED.amount,
      due_date = EXCLUDED.due_date,
      status   = CASE WHEN financial_transactions.status='PAID' THEN 'PAID' ELSE 'PLANNED' END,
      updated_at = now();
  ELSE
    UPDATE public.financial_transactions
       SET status='CANCELED', updated_at=now()
     WHERE company_id=v_pay.company_id
       AND origin_type='QUOTE_RECEIVABLE_BALANCE'
       AND origin_id=v_quote.id
       AND deleted_at IS NULL
       AND status <> 'PAID';
  END IF;

  UPDATE public.quotes
     SET paid_amount = v_paid_sum,
         remaining_amount = v_remaining,
         financial_status = v_fin_status,
         payment_approved_at = COALESCE(payment_approved_at, now()),
         updated_at = now()
   WHERE id = v_quote.id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_quote_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_quote_payment(uuid, text) TO authenticated;

-- ============================================================
-- create_project_from_quote (idempotente)
-- ============================================================
CREATE FUNCTION public.create_project_from_quote(_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote   public.quotes%ROWTYPE;
  v_prof_co uuid;
  v_pid     uuid;
BEGIN
  IF NOT (
    public.has_permission('projects.convert_from_quote')
    OR public.has_permission('projects.create')
    OR public.has_permission('quotes.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar projeto' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id=_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  SELECT company_id INTO v_prof_co FROM public.profiles WHERE id=auth.uid();
  IF (v_prof_co IS NULL OR v_prof_co <> v_quote.company_id) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem acesso a este orçamento' USING ERRCODE='42501';
  END IF;

  IF v_quote.project_id IS NOT NULL THEN
    RETURN v_quote.project_id;
  END IF;

  SELECT id INTO v_pid FROM public.projects
   WHERE company_id=v_quote.company_id AND quote_id=_quote_id LIMIT 1;

  IF v_pid IS NULL THEN
    INSERT INTO public.projects (
      company_id, quote_id, customer_id, title, description,
      status, priority, material_status, planning_status,
      total_amount, remaining_amount, financial_status, created_by
    ) VALUES (
      v_quote.company_id, v_quote.id, v_quote.customer_id,
      COALESCE(v_quote.title, 'Projeto do orçamento ' || COALESCE(v_quote.quote_number,'')),
      v_quote.description,
      'DRAFT','NORMAL','NOT_CHECKED','PENDING',
      COALESCE(v_quote.total_amount,0),
      COALESCE(v_quote.remaining_amount, v_quote.total_amount, 0),
      COALESCE(v_quote.financial_status,'UNPAID'),
      auth.uid()
    ) RETURNING id INTO v_pid;
  END IF;

  UPDATE public.quotes SET project_id=v_pid, updated_at=now() WHERE id=_quote_id;
  RETURN v_pid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_from_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_from_quote(uuid) TO authenticated;
