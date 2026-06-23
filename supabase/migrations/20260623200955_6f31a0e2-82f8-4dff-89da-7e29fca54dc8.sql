
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS down_payment_percent NUMERIC(5,2) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS down_payment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMPTZ;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS pix_receiver_name TEXT,
  ADD COLUMN IF NOT EXISTS pix_receiver_city TEXT;

CREATE TABLE IF NOT EXISTS public.quote_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  customer_id UUID,
  payment_type TEXT NOT NULL DEFAULT 'DOWN_PAYMENT',
  payment_method TEXT NOT NULL DEFAULT 'PIX',
  payment_status TEXT NOT NULL DEFAULT 'WAITING_PAYMENT',
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  pix_key TEXT,
  pix_copy_paste TEXT,
  pix_qr_code_url TEXT,
  pix_txid TEXT,
  provider TEXT,
  provider_charge_id TEXT,
  provider_payload JSONB,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  approved_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_quote_payments_quote ON public.quote_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_company ON public.quote_payments(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_payments TO authenticated;
GRANT ALL ON public.quote_payments TO service_role;

ALTER TABLE public.quote_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_payments_select_own_company"
  ON public.quote_payments FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "quote_payments_insert_own_company"
  ON public.quote_payments FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "quote_payments_update_own_company"
  ON public.quote_payments FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "quote_payments_delete_own_company"
  ON public.quote_payments FOR DELETE TO authenticated
  USING (company_id = public.current_company_id());

CREATE TRIGGER trg_quote_payments_updated
  BEFORE UPDATE ON public.quote_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('quote_payments.view',     'quote_payments', 'view',     'Ver pagamentos de orçamento'),
  ('quote_payments.create',   'quote_payments', 'create',   'Criar cobrança de orçamento'),
  ('quote_payments.send_pix', 'quote_payments', 'send_pix', 'Enviar Pix por WhatsApp'),
  ('quote_payments.approve',  'quote_payments', 'approve',  'Aprovar pagamento de orçamento'),
  ('quote_payments.cancel',   'quote_payments', 'cancel',   'Cancelar cobrança de orçamento')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.accept_public_quote(_token uuid, _name text, _document text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  q RECORD; s RECORD;
  pct NUMERIC; down NUMERIC; remain NUMERIC; pay_id UUID;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.'; END IF;
  IF q.status NOT IN ('SENT','VIEWED','DRAFT') THEN
    RAISE EXCEPTION 'Este orçamento não pode mais ser aceito (status: %).', q.status;
  END IF;
  IF _name IS NULL OR length(trim(_name)) < 3 THEN
    RAISE EXCEPTION 'Informe o nome completo do responsável.';
  END IF;

  pct := COALESCE(q.down_payment_percent, 50);
  down := ROUND(COALESCE(q.total_amount,0) * pct / 100.0, 2);
  remain := GREATEST(0, ROUND(COALESCE(q.total_amount,0) - down, 2));

  UPDATE public.quotes SET
    status = 'APPROVED',
    accepted_at = now(),
    approved_at = now(),
    accepted_by_name = trim(_name),
    accepted_by_document = NULLIF(trim(COALESCE(_document,'')), ''),
    down_payment_amount = down,
    remaining_amount = remain,
    payment_status = CASE WHEN down > 0 THEN 'WAITING_PAYMENT' ELSE 'NOT_STARTED' END
  WHERE id = q.id;

  INSERT INTO public.quote_history(company_id, quote_id, event_type, actor_label, meta)
    VALUES (q.company_id, q.id, 'accepted', trim(_name),
      jsonb_build_object('document', _document));

  IF down > 0 THEN
    SELECT pix_key, pix_key_type INTO s FROM public.company_settings WHERE company_id = q.company_id;
    INSERT INTO public.quote_payments
      (company_id, quote_id, customer_id, payment_type, payment_method, payment_status,
       amount, description, pix_key)
      VALUES (q.company_id, q.id, q.customer_id, 'DOWN_PAYMENT', 'PIX', 'WAITING_PAYMENT',
              down, format('Entrada referente ao orçamento #%s', q.quote_number),
              COALESCE(s.pix_key, NULL))
      RETURNING id INTO pay_id;

    INSERT INTO public.quote_history(company_id, quote_id, event_type, actor_label, meta)
      VALUES (q.company_id, q.id, 'payment_created', 'sistema',
        jsonb_build_object('payment_id', pay_id, 'amount', down));
  END IF;

  RETURN jsonb_build_object('ok', true, 'quote_id', q.id, 'payment_id', pay_id);
END $function$;

CREATE OR REPLACE FUNCTION public.get_public_quote_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  q RECORD; c RECORD; co RECORD; s RECORD; p RECORD; items JSONB;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id, name, trade_name, corporate_name, cpf_cnpj
    INTO c FROM public.customers WHERE id = q.customer_id;
  SELECT corporate_name, trade_name, cnpj, email, phone, whatsapp, logo_url
    INTO co FROM public.companies WHERE id = q.company_id;
  SELECT pix_key, pix_key_type, pix_receiver_name, pix_receiver_city
    INTO s FROM public.company_settings WHERE company_id = q.company_id;
  SELECT id, amount, payment_status, pix_key, pix_copy_paste, pix_qr_code_url, paid_at
    INTO p FROM public.quote_payments
    WHERE quote_id = q.id AND payment_type = 'DOWN_PAYMENT'
    ORDER BY created_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', qi.id, 'name', qi.name, 'description', qi.description,
           'kind', qi.kind, 'quantity', qi.quantity,
           'unit', COALESCE(it.unit::text, 'UN'),
           'image_url', img.file_url, 'position', qi.position
         ) ORDER BY qi.position, qi.created_at), '[]'::jsonb)
    INTO items
    FROM public.quote_items qi
    LEFT JOIN public.items it ON it.id = qi.item_id
    LEFT JOIN LATERAL (
      SELECT ii.file_url FROM public.item_images ii
      WHERE ii.item_id = qi.item_id
      ORDER BY ii.is_primary DESC, ii.created_at ASC LIMIT 1
    ) img ON TRUE
    WHERE qi.quote_id = q.id AND qi.kind <> 'LABOR';

  RETURN jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id, 'quote_number', q.quote_number, 'status', q.status, 'title', q.title,
      'issue_date', q.issue_date, 'valid_until', q.valid_until,
      'payment_terms', q.payment_terms, 'delivery_terms', q.delivery_terms,
      'warranty_terms', q.warranty_terms, 'completion_estimate', q.completion_estimate,
      'customer_notes', q.customer_notes, 'total_amount', q.total_amount,
      'accepted_at', q.accepted_at, 'accepted_by_name', q.accepted_by_name,
      'payment_status', q.payment_status,
      'down_payment_amount', q.down_payment_amount,
      'remaining_amount', q.remaining_amount,
      'down_payment_percent', q.down_payment_percent
    ),
    'customer', jsonb_build_object('name', COALESCE(c.trade_name, c.name, c.corporate_name), 'document', c.cpf_cnpj),
    'company', jsonb_build_object('name', COALESCE(co.trade_name, co.corporate_name),
                                  'cnpj', co.cnpj, 'email', co.email,
                                  'phone', co.phone, 'whatsapp', co.whatsapp, 'logo_url', co.logo_url),
    'pix', CASE WHEN s.pix_key IS NOT NULL THEN jsonb_build_object(
              'pix_key', s.pix_key, 'pix_key_type', s.pix_key_type,
              'receiver_name', s.pix_receiver_name, 'receiver_city', s.pix_receiver_city
           ) ELSE NULL END,
    'payment', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
              'id', p.id, 'amount', p.amount, 'payment_status', p.payment_status,
              'pix_key', p.pix_key, 'pix_copy_paste', p.pix_copy_paste,
              'pix_qr_code_url', p.pix_qr_code_url, 'paid_at', p.paid_at
           ) ELSE NULL END,
    'items', items
  );
END $function$;

CREATE OR REPLACE FUNCTION public.approve_quote_payment(_payment_id uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid UUID := auth.uid(); cid UUID; pay RECORD;
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
    SET payment_status='APPROVED', paid_at=now(), approved_by=uid,
        description = COALESCE(NULLIF(_note,''), description), updated_at=now()
    WHERE id = _payment_id;
  UPDATE public.quotes
    SET payment_status='PAYMENT_APPROVED', payment_approved_at=now()
    WHERE id = pay.quote_id;
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

CREATE OR REPLACE FUNCTION public.cancel_quote_payment(_payment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid UUID := auth.uid(); cid UUID; pay RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('quote_payments.cancel')) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar cobrança.';
  END IF;
  SELECT * INTO pay FROM public.quote_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado.'; END IF;
  IF pay.company_id <> cid THEN RAISE EXCEPTION 'Pagamento de outra empresa.'; END IF;
  IF pay.payment_status = 'APPROVED' THEN RAISE EXCEPTION 'Pagamento já aprovado não pode ser cancelado.'; END IF;
  UPDATE public.quote_payments
    SET payment_status='CANCELLED', cancelled_at=now(),
        description = COALESCE(NULLIF(_reason,''), description)
    WHERE id = _payment_id;
  UPDATE public.quotes SET payment_status='PAYMENT_CANCELLED' WHERE id = pay.quote_id;
  INSERT INTO public.quote_history(company_id, quote_id, event_type, actor_label, meta)
    VALUES (cid, pay.quote_id, 'payment_cancelled', 'usuário',
      jsonb_build_object('payment_id', _payment_id, 'reason', _reason));
  PERFORM public.log_audit('quote_payments','cancel', _payment_id, NULL,
    jsonb_build_object('quote_id', pay.quote_id));
  RETURN jsonb_build_object('ok', true);
END $function$;
