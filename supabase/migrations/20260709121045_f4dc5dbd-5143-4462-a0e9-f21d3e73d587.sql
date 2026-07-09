
-- ============================================================
-- PR2: Comprovantes de pagamento (payment receipts)
-- ============================================================

-- 1) Campos de comprovante em quote_payments
ALTER TABLE public.quote_payments
  ADD COLUMN IF NOT EXISTS receipt_file_path text,
  ADD COLUMN IF NOT EXISTS receipt_mime_type text,
  ADD COLUMN IF NOT EXISTS receipt_size integer,
  ADD COLUMN IF NOT EXISTS receipt_status text,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_rejection_reason text,
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payment_date date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_payments_receipt_status_chk') THEN
    ALTER TABLE public.quote_payments
      ADD CONSTRAINT quote_payments_receipt_status_chk
      CHECK (receipt_status IS NULL OR receipt_status IN ('PENDING_REVIEW','APPROVED','REJECTED'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_payments_receipt_mime_chk') THEN
    ALTER TABLE public.quote_payments
      ADD CONSTRAINT quote_payments_receipt_mime_chk
      CHECK (receipt_mime_type IS NULL OR receipt_mime_type IN (
        'application/pdf','image/jpeg','image/png','image/webp'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_payments_receipt_size_chk') THEN
    ALTER TABLE public.quote_payments
      ADD CONSTRAINT quote_payments_receipt_size_chk
      CHECK (receipt_size IS NULL OR (receipt_size > 0 AND receipt_size <= 10485760));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quote_payments_receipt_status
  ON public.quote_payments (company_id, receipt_status)
  WHERE receipt_status IS NOT NULL;

-- 2) Trigger BEFORE UPDATE: sincroniza receipt_status quando pagamento é aprovado/rejeitado
CREATE OR REPLACE FUNCTION public.tg_quote_payments_sync_receipt_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'APPROVED'
     AND (OLD.payment_status IS DISTINCT FROM 'APPROVED')
     AND NEW.receipt_file_path IS NOT NULL
     AND (NEW.receipt_status IS DISTINCT FROM 'APPROVED') THEN
    NEW.receipt_status := 'APPROVED';
    NEW.receipt_reviewed_by := COALESCE(NEW.receipt_reviewed_by, auth.uid());
    NEW.receipt_reviewed_at := COALESCE(NEW.receipt_reviewed_at, now());
  END IF;

  IF NEW.payment_status = 'REJECTED'
     AND (OLD.payment_status IS DISTINCT FROM 'REJECTED')
     AND NEW.receipt_file_path IS NOT NULL
     AND (NEW.receipt_status IS DISTINCT FROM 'REJECTED') THEN
    NEW.receipt_status := 'REJECTED';
    NEW.receipt_reviewed_by := COALESCE(NEW.receipt_reviewed_by, auth.uid());
    NEW.receipt_reviewed_at := COALESCE(NEW.receipt_reviewed_at, now());
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quote_payments_sync_receipt_on_approval ON public.quote_payments;
CREATE TRIGGER quote_payments_sync_receipt_on_approval
  BEFORE UPDATE ON public.quote_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_payments_sync_receipt_on_approval();

-- 3) RPC pública: submit_public_quote_receipt
CREATE OR REPLACE FUNCTION public.submit_public_quote_receipt(
  _token uuid,
  _amount numeric,
  _payer_name text,
  _payment_date date,
  _payment_method text,
  _mime text,
  _size integer,
  _ext text
)
RETURNS TABLE (payment_id uuid, upload_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    receipt_status, receipt_uploaded_at,
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
    'PENDING_REVIEW', now(),
    'Comprovante enviado pelo cliente (aguardando revisão)'
  );

  payment_id := v_payment_id;
  upload_path := v_path;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.submit_public_quote_receipt(uuid,numeric,text,date,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_quote_receipt(uuid,numeric,text,date,text,text,integer,text) TO service_role;

-- Rollback controlado se upload falhar
CREATE OR REPLACE FUNCTION public.rollback_public_quote_receipt(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM quote_payments
   WHERE id = _payment_id
     AND payment_status = 'WAITING_PAYMENT'
     AND receipt_status = 'PENDING_REVIEW';
END $$;

REVOKE ALL ON FUNCTION public.rollback_public_quote_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollback_public_quote_receipt(uuid) TO service_role;

-- 4) RPC reject_quote_payment_receipt (dono/super_admin/manager + permissão financeira)
CREATE OR REPLACE FUNCTION public.reject_quote_payment_receipt(
  _payment_id uuid,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row quote_payments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT (
    public.has_permission('finance.receivables.manage')
    OR public.has_permission('finance.manage')
    OR public.has_role(v_uid, 'owner'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_role(v_uid, 'manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar comprovantes.';
  END IF;

  SELECT * INTO v_row FROM quote_payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  IF v_row.company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'Pagamento de outra empresa.';
  END IF;

  IF v_row.payment_status = 'APPROVED' THEN
    RAISE EXCEPTION 'Pagamento já aprovado.';
  END IF;

  UPDATE quote_payments
     SET payment_status = 'REJECTED',
         receipt_status = CASE WHEN receipt_file_path IS NOT NULL THEN 'REJECTED' ELSE receipt_status END,
         receipt_rejection_reason = NULLIF(trim(_reason), ''),
         receipt_reviewed_by = v_uid,
         receipt_reviewed_at = now(),
         cancelled_at = now()
   WHERE id = _payment_id;
END $$;

REVOKE ALL ON FUNCTION public.reject_quote_payment_receipt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_quote_payment_receipt(uuid, text) TO authenticated;

-- 5) Storage policies para bucket "payment-receipts" (bucket criado via ferramenta separada)
DROP POLICY IF EXISTS "payment_receipts_select_same_company" ON storage.objects;
CREATE POLICY "payment_receipts_select_same_company"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND (
      public.has_permission('finance.receivables.manage')
      OR public.has_permission('finance.manage')
      OR public.has_permission('finance.view')
      OR public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

DROP POLICY IF EXISTS "payment_receipts_insert_internal" ON storage.objects;
CREATE POLICY "payment_receipts_insert_internal"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND (
      public.has_permission('finance.receivables.manage')
      OR public.has_permission('finance.manage')
      OR public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );
