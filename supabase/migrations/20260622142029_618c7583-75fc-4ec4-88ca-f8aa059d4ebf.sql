
-- Phase 2.4 Part B — public link, acceptance, history

-- 1) Add columns to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS public_token UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS accepted_by_document TEXT,
  ADD COLUMN IF NOT EXISTS accepted_ip TEXT,
  ADD COLUMN IF NOT EXISTS first_sent_at TIMESTAMPTZ;

UPDATE public.quotes SET public_token = gen_random_uuid() WHERE public_token IS NULL;
ALTER TABLE public.quotes ALTER COLUMN public_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON public.quotes(public_token);

-- 2) Quote history table
CREATE TABLE IF NOT EXISTS public.quote_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_history_quote ON public.quote_history(quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_history_company ON public.quote_history(company_id);

GRANT SELECT, INSERT ON public.quote_history TO authenticated;
GRANT ALL ON public.quote_history TO service_role;

ALTER TABLE public.quote_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_history_select" ON public.quote_history FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('quotes.view') OR public.has_permission('quotes.manage'))
  );

CREATE POLICY "quote_history_insert" ON public.quote_history FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('quotes.view') OR public.has_permission('quotes.manage'))
  );

-- 3) Public RPC: read quote by token (NO unit prices / subtotals exposed)
CREATE OR REPLACE FUNCTION public.get_public_quote_by_token(_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q RECORD;
  c RECORD;
  co RECORD;
  items JSONB;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id, name, trade_name, corporate_name, cpf_cnpj
    INTO c FROM public.customers WHERE id = q.customer_id;

  SELECT corporate_name, trade_name, cnpj, email, phone, whatsapp, logo_url
    INTO co FROM public.companies WHERE id = q.company_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', qi.id,
           'name', qi.name,
           'description', qi.description,
           'kind', qi.kind,
           'quantity', qi.quantity,
           'position', qi.position
         ) ORDER BY qi.position, qi.created_at), '[]'::jsonb)
    INTO items
    FROM public.quote_items qi
    WHERE qi.quote_id = q.id AND qi.kind <> 'LABOR';

  RETURN jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id,
      'quote_number', q.quote_number,
      'status', q.status,
      'title', q.title,
      'issue_date', q.issue_date,
      'valid_until', q.valid_until,
      'payment_terms', q.payment_terms,
      'delivery_terms', q.delivery_terms,
      'warranty_terms', q.warranty_terms,
      'completion_estimate', q.completion_estimate,
      'customer_notes', q.customer_notes,
      'total_amount', q.total_amount,
      'accepted_at', q.accepted_at,
      'accepted_by_name', q.accepted_by_name
    ),
    'customer', jsonb_build_object(
      'name', COALESCE(c.trade_name, c.name, c.corporate_name),
      'document', c.cpf_cnpj
    ),
    'company', jsonb_build_object(
      'name', COALESCE(co.trade_name, co.corporate_name),
      'cnpj', co.cnpj,
      'email', co.email,
      'phone', co.phone,
      'whatsapp', co.whatsapp,
      'logo_url', co.logo_url
    ),
    'items', items
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_public_quote_by_token(UUID) TO anon, authenticated;

-- 4) Public RPC: register view
CREATE OR REPLACE FUNCTION public.register_public_quote_view(_token UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE q RECORD;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RETURN; END IF;

  IF q.viewed_at IS NULL THEN
    UPDATE public.quotes SET viewed_at = now() WHERE id = q.id;
  END IF;

  IF q.status = 'SENT' THEN
    UPDATE public.quotes SET status = 'VIEWED' WHERE id = q.id;
  END IF;

  INSERT INTO public.quote_history(company_id, quote_id, event_type, actor_label, meta)
    VALUES (q.company_id, q.id, 'viewed', 'cliente', '{}'::jsonb);
END $$;

GRANT EXECUTE ON FUNCTION public.register_public_quote_view(UUID) TO anon, authenticated;

-- 5) Public RPC: accept quote
CREATE OR REPLACE FUNCTION public.accept_public_quote(
  _token UUID,
  _name TEXT,
  _document TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE q RECORD;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.'; END IF;

  IF q.status NOT IN ('SENT','VIEWED','DRAFT') THEN
    RAISE EXCEPTION 'Este orçamento não pode mais ser aceito (status: %).', q.status;
  END IF;

  IF _name IS NULL OR length(trim(_name)) < 3 THEN
    RAISE EXCEPTION 'Informe o nome completo do responsável.';
  END IF;

  UPDATE public.quotes SET
    status = 'APPROVED',
    accepted_at = now(),
    approved_at = now(),
    accepted_by_name = trim(_name),
    accepted_by_document = NULLIF(trim(COALESCE(_document,'')), '')
  WHERE id = q.id;

  INSERT INTO public.quote_history(company_id, quote_id, event_type, actor_label, meta)
    VALUES (q.company_id, q.id, 'accepted', trim(_name),
      jsonb_build_object('document', _document));

  RETURN jsonb_build_object('ok', true, 'quote_id', q.id);
END $$;

GRANT EXECUTE ON FUNCTION public.accept_public_quote(UUID, TEXT, TEXT) TO anon, authenticated;

-- 6) Update markQuoteSent behavior: track first_sent_at via trigger
CREATE OR REPLACE FUNCTION public.quotes_track_sent()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'SENT' AND OLD.status IS DISTINCT FROM 'SENT' AND NEW.first_sent_at IS NULL THEN
    NEW.first_sent_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quotes_track_sent_trg ON public.quotes;
CREATE TRIGGER quotes_track_sent_trg
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_track_sent();
