-- Fix approve_quote_payment to sweep legacy transactions + add resync_quote_payment
CREATE OR REPLACE FUNCTION public.approve_quote_payment(_payment_id uuid, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Cancel legacy transactions for this quote that don't use the new origin_type scheme
  UPDATE public.financial_transactions
     SET status='CANCELED', updated_at=now()
   WHERE quote_id = v_quote.id
     AND deleted_at IS NULL
     AND status <> 'CANCELED'
     AND (
       origin_type IS NULL
       OR origin_type NOT IN ('QUOTE_PAYMENT','QUOTE_RECEIVABLE_BALANCE')
     );

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
$function$;

-- Idempotent resync helper: recomputes financeiro state for an already-APPROVED payment
CREATE OR REPLACE FUNCTION public.resync_quote_payment(_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pay public.quote_payments%ROWTYPE;
BEGIN
  IF NOT (
    public.has_permission('quote_payments.approve')
    OR public.has_permission('finance.receivables.manage')
    OR public.has_permission('finance.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ressincronizar pagamento' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_pay FROM public.quote_payments WHERE id=_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;
  IF v_pay.payment_status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Só pagamentos APPROVED podem ser ressincronizados' USING ERRCODE='22023';
  END IF;

  -- Re-run the same logic used by approve_quote_payment
  PERFORM public.approve_quote_payment(_payment_id, NULL);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resync_quote_payment(uuid) TO authenticated;