
-- 1) Mask CPF/CNPJ in public quote RPC
CREATE OR REPLACE FUNCTION public.get_public_quote_by_token(_token uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

-- 2) Mask CPF/CNPJ in public service order report
CREATE OR REPLACE FUNCTION public.get_public_so_report(_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rep public.service_order_reports;
  so RECORD; cust RECORD; comp RECORD; addr RECORD; result JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RAISE EXCEPTION 'Token inválido.'; END IF;
  SELECT * INTO rep FROM public.service_order_reports
    WHERE public_token = _token AND status IN ('GENERATED','SENT','SIGNED');
  IF NOT FOUND THEN RAISE EXCEPTION 'Relatório não encontrado.'; END IF;
  SELECT * INTO so FROM public.service_orders WHERE id = rep.service_order_id;
  SELECT name INTO cust FROM public.customers WHERE id = so.customer_id;
  SELECT corporate_name, trade_name, cnpj, email, phone, whatsapp, logo_url
    INTO comp FROM public.companies WHERE id = so.company_id;
  SELECT street, number, complement, neighborhood, city, state, zip_code
    INTO addr FROM public.customer_addresses WHERE id = so.customer_address_id;
  result := jsonb_build_object(
    'report', jsonb_build_object(
      'id', rep.id, 'report_number', rep.report_number, 'status', rep.status,
      'generated_at', rep.generated_at, 'pdf_file_url', rep.pdf_file_url,
      'pdf_file_name', rep.pdf_file_name
    ),
    'service_order', jsonb_build_object(
      'id', so.id, 'service_order_number', so.service_order_number,
      'title', so.title, 'description', so.description,
      'scheduled_date', so.scheduled_date, 'started_at', so.started_at,
      'completed_at', so.completed_at, 'technician_report', so.technician_report,
      'issue_found', so.issue_found, 'solution_applied', so.solution_applied
    ),
    'customer', jsonb_build_object('name', cust.name),
    'company', to_jsonb(comp), 'address', to_jsonb(addr),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'description', i.description,
        'item_type', i.item_type, 'planned_quantity', i.planned_quantity,
        'used_quantity', i.used_quantity, 'unit', i.unit, 'position', i.position
      ) ORDER BY i.position)
      FROM public.service_order_items i WHERE i.service_order_id = so.id
    ), '[]'::jsonb),
    'materials', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'quantity', m.quantity, 'unit', m.unit))
      FROM public.service_order_material_usage m WHERE m.service_order_id = so.id
    ), '[]'::jsonb),
    'checklist', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'is_required', c.is_required,
        'is_completed', c.is_completed, 'position', c.position) ORDER BY c.position)
      FROM public.service_order_checklist_items c WHERE c.service_order_id = so.id
    ), '[]'::jsonb),
    'signatures', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'signature_type', s.signature_type,
        'signer_name', s.signer_name, 'signed_at', s.signed_at, 'signature_file_url', s.signature_file_url))
      FROM public.service_order_signatures s WHERE s.service_order_id = so.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'storage_path', p.storage_path, 'caption', p.caption, 'taken_at', p.taken_at))
      FROM public.service_order_photos p WHERE p.service_order_id = so.id
    ), '[]'::jsonb)
  );
  RETURN result;
END $function$;

-- 3) Notifications: scope insert to authenticated
DROP POLICY IF EXISTS notif_insert_company ON public.notifications;
CREATE POLICY notif_insert_company ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id());

-- 4) cnpj_lookup_cache, billing_webhook_events, billing_provider_settings: service-role only
REVOKE ALL ON public.cnpj_lookup_cache FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.cnpj_lookup_cache TO service_role;

REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.billing_webhook_events TO service_role;

REVOKE ALL ON public.billing_provider_settings FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.billing_provider_settings TO service_role;

-- 5) Revoke EXECUTE on every SECURITY DEFINER public function from PUBLIC/anon/authenticated,
--    then re-grant intentionally exposed ones.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant: public token-based endpoints (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.get_public_quote_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_so_report(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_public_quote_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_public_quote(uuid, text, text) TO anon, authenticated;

-- Re-grant: every other SECURITY DEFINER function in public schema to authenticated only.
-- These all enforce auth.uid()/company scoping internally; revoking from PUBLIC/anon is the
-- security fix. Signed-in users keep their existing access.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname NOT IN ('get_public_quote_by_token','get_public_so_report',
                            'register_public_quote_view','accept_public_quote')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;
