-- Snapshot da imagem do produto no item do orçamento (histórico congelado).
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS image_path text;

-- RPC público: retorna image_path (snapshot ou fallback via item_images primária).
-- Não retorna URL assinada; o cliente público chama /api/public/quote-image-urls para assinar.
CREATE OR REPLACE FUNCTION public.get_public_quote_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  q RECORD; c RECORD; co RECORD; s RECORD; p RECORD; items JSONB;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id, name, trade_name, corporate_name INTO c FROM public.customers WHERE id = q.customer_id;
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
           'image_path', COALESCE(qi.image_path, img.file_path),
           'position', qi.position
         ) ORDER BY qi.position, qi.created_at), '[]'::jsonb)
    INTO items
    FROM public.quote_items qi
    LEFT JOIN public.items it ON it.id = qi.item_id
    LEFT JOIN LATERAL (
      SELECT ii.file_path FROM public.item_images ii
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
    'customer', jsonb_build_object('name', COALESCE(c.trade_name, c.name, c.corporate_name), 'document', NULL),
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

-- RPC utilitária: valida que os paths pertencem ao orçamento do token
-- (usado pela rota pública que assina URLs com supabaseAdmin).
CREATE OR REPLACE FUNCTION public.validate_public_quote_image_paths(_token uuid, _paths text[])
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH q AS (SELECT id, company_id FROM public.quotes WHERE public_token = _token)
  SELECT COALESCE(array_agg(DISTINCT p), ARRAY[]::text[])
  FROM unnest(_paths) AS p
  WHERE EXISTS (
    SELECT 1
    FROM q
    LEFT JOIN public.quote_items qi ON qi.quote_id = q.id
    LEFT JOIN public.item_images ii ON ii.item_id = qi.item_id
    WHERE qi.image_path = p OR ii.file_path = p
  );
$$;

GRANT EXECUTE ON FUNCTION public.validate_public_quote_image_paths(uuid, text[]) TO anon, authenticated, service_role;
