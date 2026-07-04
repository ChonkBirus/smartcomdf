-- 1) Índice único parcial: 1 recebível ativo por orçamento
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_quote_income_uniq
  ON public.financial_transactions (company_id, quote_id)
  WHERE type = 'INCOME' AND origin = 'QUOTE' AND deleted_at IS NULL;

-- 2) RPC atômico: aprova pagamento + espelha para financial_transactions
CREATE OR REPLACE FUNCTION public.approve_quote_payment(_payment_id uuid, _note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid   UUID := auth.uid();
  cid   UUID;
  pay   RECORD;
  q     RECORD;
  existing_id UUID;
  now_ts TIMESTAMPTZ := now();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Sem empresa.'; END IF;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('quote_payments.approve')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar pagamento.';
  END IF;

  SELECT * INTO pay FROM public.quote_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado.'; END IF;
  IF pay.company_id <> cid THEN RAISE EXCEPTION 'Pagamento de outra empresa.'; END IF;
  IF pay.payment_status = 'CANCELLED' THEN RAISE EXCEPTION 'Pagamento cancelado não pode ser aprovado.'; END IF;
  IF pay.payment_status = 'APPROVED' THEN RAISE EXCEPTION 'Pagamento já aprovado.'; END IF;

  UPDATE public.quote_payments
    SET payment_status='APPROVED', paid_at=now_ts, approved_by=uid,
        description = COALESCE(NULLIF(_note,''), description), updated_at=now_ts
    WHERE id = _payment_id;

  UPDATE public.quotes
    SET payment_status='PAYMENT_APPROVED', payment_approved_at=now_ts
    WHERE id = pay.quote_id;

  -- Espelhamento atômico em financial_transactions
  SELECT id INTO existing_id
    FROM public.financial_transactions
    WHERE company_id = pay.company_id
      AND quote_id   = pay.quote_id
      AND type       = 'INCOME'
      AND origin     = 'QUOTE'
      AND deleted_at IS NULL
    LIMIT 1;

  IF existing_id IS NOT NULL THEN
    UPDATE public.financial_transactions
      SET status = 'PAID',
          paid_at = COALESCE(paid_at, now_ts),
          payment_method = COALESCE(pay.payment_method, payment_method),
          updated_at = now_ts
      WHERE id = existing_id AND status <> 'PAID';
  ELSE
    SELECT customer_id, total_amount, valid_until INTO q
      FROM public.quotes
      WHERE id = pay.quote_id AND company_id = pay.company_id;

    INSERT INTO public.financial_transactions(
      company_id, type, description, amount, due_date, paid_at, status,
      customer_id, quote_id, payment_method, origin, created_by
    ) VALUES (
      pay.company_id, 'INCOME',
      'Recebível do orçamento (pagamento aprovado)',
      COALESCE(q.total_amount, pay.amount, 0),
      COALESCE(q.valid_until, now_ts::date),
      now_ts, 'PAID',
      q.customer_id, pay.quote_id, pay.payment_method, 'QUOTE', uid
    )
    ON CONFLICT (company_id, quote_id)
      WHERE type = 'INCOME' AND origin = 'QUOTE' AND deleted_at IS NULL
    DO UPDATE SET
      status = 'PAID',
      paid_at = COALESCE(public.financial_transactions.paid_at, EXCLUDED.paid_at),
      payment_method = COALESCE(EXCLUDED.payment_method, public.financial_transactions.payment_method),
      updated_at = now_ts;
  END IF;

  INSERT INTO public.quote_history(company_id, quote_id, event_type, actor_label, meta)
    VALUES (cid, pay.quote_id, 'payment_approved', 'usuário',
      jsonb_build_object('payment_id', _payment_id, 'amount', pay.amount, 'note', _note));
  PERFORM public.log_audit('quote_payments','approve', _payment_id, NULL,
    jsonb_build_object('quote_id', pay.quote_id, 'amount', pay.amount));
  PERFORM public.log_activity(format('Pagamento da entrada aprovado (R$ %s).', pay.amount));
  PERFORM public.notify_user(uid, cid, 'Pagamento aprovado',
    format('Entrada do orçamento aprovada: R$ %s.', pay.amount));

  RETURN jsonb_build_object('ok', true);
END $function$;

-- 3) Backfill: para orçamentos já aprovados sem recebível espelhado
INSERT INTO public.financial_transactions(
  company_id, type, description, amount, due_date, paid_at, status,
  customer_id, quote_id, payment_method, origin, created_by
)
SELECT
  qp.company_id, 'INCOME',
  'Recebível do orçamento (pagamento aprovado)',
  COALESCE(q.total_amount, qp.amount, 0),
  COALESCE(q.valid_until, qp.paid_at::date, now()::date),
  qp.paid_at, 'PAID',
  q.customer_id, qp.quote_id, qp.payment_method, 'QUOTE', qp.approved_by
FROM public.quote_payments qp
JOIN public.quotes q ON q.id = qp.quote_id AND q.company_id = qp.company_id
WHERE qp.payment_status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft
     WHERE ft.company_id = qp.company_id
       AND ft.quote_id   = qp.quote_id
       AND ft.type       = 'INCOME'
       AND ft.origin     = 'QUOTE'
       AND ft.deleted_at IS NULL
  )
ON CONFLICT DO NOTHING;
