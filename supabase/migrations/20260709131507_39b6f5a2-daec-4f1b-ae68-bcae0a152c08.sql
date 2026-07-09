
ALTER TABLE public.quote_payments
  ADD COLUMN IF NOT EXISTS receipt_source text;

ALTER TABLE public.quote_payments
  DROP CONSTRAINT IF EXISTS quote_payments_receipt_source_chk;

ALTER TABLE public.quote_payments
  ADD CONSTRAINT quote_payments_receipt_source_chk
  CHECK (receipt_source IS NULL OR receipt_source IN ('PUBLIC','INTERNAL'));

-- Atualiza a RPC pública para carimbar sempre PUBLIC
CREATE OR REPLACE FUNCTION public.submit_public_quote_receipt(
  _token uuid, _amount numeric, _payer_name text, _payment_date date,
  _payment_method text, _mime text, _size integer, _ext text
)
RETURNS TABLE(payment_id uuid, upload_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote quotes%ROWTYPE;
  v_payment_id uuid := gen_random_uuid();
  v_file_uuid uuid := gen_random_uuid();
  v_safe_ext text;
  v_path text;
  v_remaining numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido.';
  END IF;
  IF _mime NOT IN ('application/pdf','image/jpeg','image/png','image/webp') THEN
    RAISE EXCEPTION 'Tipo de arquivo não suportado.';
  END IF;
  IF _size IS NULL OR _size <= 0 OR _size > 10485760 THEN
    RAISE EXCEPTION 'Arquivo excede 10 MB ou é inválido.';
  END IF;
  v_safe_ext := lower(regexp_replace(coalesce(_ext,''), '[^a-z0-9]', '', 'g'));
  IF v_safe_ext NOT IN ('pdf','jpg','jpeg','png','webp') THEN
    RAISE EXCEPTION 'Extensão de arquivo não suportada.';
  END IF;

  SELECT * INTO v_quote FROM quotes WHERE public_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;
  IF v_quote.status IN ('REJECTED','CANCELLED','EXPIRED') THEN
    RAISE EXCEPTION 'Este orçamento não aceita mais pagamentos.';
  END IF;
  v_remaining := COALESCE(v_quote.remaining_amount, v_quote.total_amount);
  IF _amount > COALESCE(v_remaining, v_quote.total_amount) + 0.01 THEN
    RAISE EXCEPTION 'Valor maior que o saldo restante.';
  END IF;

  v_path := v_quote.company_id::text || '/' || v_quote.id::text || '/' ||
            v_payment_id::text || '/' || v_file_uuid::text || '.' || v_safe_ext;

  INSERT INTO quote_payments (
    id, company_id, quote_id, customer_id,
    payment_type, payment_method, payment_status, amount,
    payer_name, payment_date,
    receipt_file_path, receipt_mime_type, receipt_size,
    receipt_status, receipt_uploaded_at, receipt_source,
    description
  ) VALUES (
    v_payment_id, v_quote.company_id, v_quote.id, v_quote.customer_id,
    'DOWN_PAYMENT',
    COALESCE(NULLIF(_payment_method,''), 'PIX'),
    'WAITING_PAYMENT',
    _amount,
    NULLIF(trim(_payer_name), ''),
    _payment_date,
    v_path, _mime, _size,
    'PENDING_REVIEW', now(), 'PUBLIC',
    'Comprovante enviado pelo cliente (aguardando revisão)'
  );

  payment_id := v_payment_id;
  upload_path := v_path;
  RETURN NEXT;
END $function$;
