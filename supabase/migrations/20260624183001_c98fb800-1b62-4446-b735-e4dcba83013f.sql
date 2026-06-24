
-- Etapa D: Relatório final + envio público da OS

-- 1) Counter table for sequential report numbers per company ----
CREATE TABLE IF NOT EXISTS public.service_order_report_counters (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  current_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.service_order_report_counters TO authenticated;
GRANT ALL ON public.service_order_report_counters TO service_role;
ALTER TABLE public.service_order_report_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "so_rep_counters_select" ON public.service_order_report_counters
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());

-- 2) Next report number helper ---------------------------------
CREATE OR REPLACE FUNCTION public.next_so_report_number(_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  seq BIGINT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT public.is_super_admin() AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND company_id = _company_id
  ) THEN RAISE EXCEPTION 'Não autorizado.'; END IF;

  INSERT INTO public.service_order_report_counters(company_id, current_number)
    VALUES (_company_id, 1)
    ON CONFLICT (company_id) DO UPDATE
      SET current_number = public.service_order_report_counters.current_number + 1,
          updated_at = now()
    RETURNING current_number INTO seq;

  RETURN 'REL-' || lpad(seq::TEXT, 6, '0');
END $$;

REVOKE ALL ON FUNCTION public.next_so_report_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_so_report_number(UUID) TO authenticated, service_role;

-- 3) Generate final report (idempotent) ------------------------
CREATE OR REPLACE FUNCTION public.so_generate_final_report(_service_order_id UUID)
RETURNS public.service_order_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  so RECORD;
  rep public.service_order_reports;
  new_token TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT public.has_permission('service_orders.generate_final_report') THEN
    RAISE EXCEPTION 'Sem permissão para gerar relatório.';
  END IF;

  SELECT * INTO so FROM public.service_orders WHERE id = _service_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  IF NOT public.can_access_service_order(_service_order_id) THEN
    RAISE EXCEPTION 'Sem acesso à OS.';
  END IF;
  IF so.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'A OS precisa estar concluída para gerar o relatório.';
  END IF;

  -- Reuse existing non-cancelled report
  SELECT * INTO rep
  FROM public.service_order_reports
  WHERE service_order_id = _service_order_id AND status <> 'CANCELLED'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN rep;
  END IF;

  new_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.service_order_reports(
    company_id, service_order_id, report_number, status,
    public_token, generated_by, generated_at
  ) VALUES (
    so.company_id, so.id,
    public.next_so_report_number(so.company_id),
    'GENERATED', new_token, uid, now()
  ) RETURNING * INTO rep;

  UPDATE public.service_orders
    SET report_status = 'GENERATED', updated_at = now()
    WHERE id = so.id;

  INSERT INTO public.service_order_execution_logs(
    service_order_id, action, performed_by, details
  ) VALUES (
    so.id, 'REPORT_GENERATED', uid,
    jsonb_build_object('report_id', rep.id, 'report_number', rep.report_number)
  );

  RETURN rep;
END $$;

REVOKE ALL ON FUNCTION public.so_generate_final_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_generate_final_report(UUID) TO authenticated, service_role;

-- 4) Attach PDF to report --------------------------------------
CREATE OR REPLACE FUNCTION public.so_attach_report_pdf(
  _report_id UUID, _pdf_path TEXT, _pdf_name TEXT
)
RETURNS public.service_order_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rep public.service_order_reports;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO rep FROM public.service_order_reports WHERE id = _report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relatório não encontrado.'; END IF;
  IF NOT public.can_access_service_order(rep.service_order_id) THEN
    RAISE EXCEPTION 'Sem acesso.';
  END IF;
  IF NOT public.has_permission('service_orders.generate_final_report') THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  UPDATE public.service_order_reports
    SET pdf_file_url = _pdf_path,
        pdf_file_name = _pdf_name,
        updated_at = now()
    WHERE id = _report_id
    RETURNING * INTO rep;

  RETURN rep;
END $$;

REVOKE ALL ON FUNCTION public.so_attach_report_pdf(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_attach_report_pdf(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 5) Log send event --------------------------------------------
CREATE OR REPLACE FUNCTION public.so_log_report_send(
  _report_id UUID,
  _channel TEXT,
  _status TEXT,
  _recipient_name TEXT DEFAULT NULL,
  _recipient_contact TEXT DEFAULT NULL,
  _message TEXT DEFAULT NULL
)
RETURNS public.service_order_report_send_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rep public.service_order_reports;
  ev public.service_order_report_send_events;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO rep FROM public.service_order_reports WHERE id = _report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relatório não encontrado.'; END IF;
  IF NOT public.can_access_service_order(rep.service_order_id) THEN
    RAISE EXCEPTION 'Sem acesso.';
  END IF;
  IF _channel IN ('WHATSAPP','EMAIL','COPY_LINK')
     AND NOT public.has_permission('service_orders.send_final_report') THEN
    RAISE EXCEPTION 'Sem permissão para enviar relatório.';
  END IF;
  IF _channel = 'PDF_DOWNLOAD'
     AND NOT public.has_permission('service_orders.download_final_report') THEN
    RAISE EXCEPTION 'Sem permissão para baixar relatório.';
  END IF;

  INSERT INTO public.service_order_report_send_events(
    company_id, service_order_id, report_id, sent_by,
    channel, recipient_name, recipient_contact, message, status
  ) VALUES (
    rep.company_id, rep.service_order_id, rep.id, uid,
    _channel, _recipient_name, _recipient_contact, _message, _status
  ) RETURNING * INTO ev;

  IF _status = 'SENT' AND _channel IN ('WHATSAPP','EMAIL') THEN
    UPDATE public.service_order_reports
      SET status = 'SENT', sent_at = now(), sent_by = uid, updated_at = now()
      WHERE id = rep.id;
    UPDATE public.service_orders
      SET report_status = 'SENT', updated_at = now()
      WHERE id = rep.service_order_id;
  END IF;

  INSERT INTO public.service_order_execution_logs(
    service_order_id, action, performed_by, details
  ) VALUES (
    rep.service_order_id, 'REPORT_SENT', uid,
    jsonb_build_object(
      'report_id', rep.id, 'channel', _channel, 'status', _status,
      'recipient', _recipient_contact
    )
  );

  RETURN ev;
END $$;

REVOKE ALL ON FUNCTION public.so_log_report_send(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_log_report_send(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 6) Public report fetch (anon-safe; no financials) ------------
CREATE OR REPLACE FUNCTION public.get_public_so_report(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep public.service_order_reports;
  so RECORD;
  cust RECORD;
  comp RECORD;
  addr RECORD;
  result JSONB;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RAISE EXCEPTION 'Token inválido.';
  END IF;
  SELECT * INTO rep FROM public.service_order_reports
    WHERE public_token = _token AND status IN ('GENERATED','SENT','SIGNED');
  IF NOT FOUND THEN RAISE EXCEPTION 'Relatório não encontrado.'; END IF;

  SELECT * INTO so FROM public.service_orders WHERE id = rep.service_order_id;
  SELECT name, cpf_cnpj INTO cust FROM public.customers WHERE id = so.customer_id;
  SELECT corporate_name, trade_name, cnpj, email, phone, whatsapp, logo_url
    INTO comp FROM public.companies WHERE id = so.company_id;
  SELECT street, number, complement, neighborhood, city, state, zip_code
    INTO addr FROM public.customer_addresses WHERE id = so.customer_address_id;

  result := jsonb_build_object(
    'report', jsonb_build_object(
      'id', rep.id,
      'report_number', rep.report_number,
      'status', rep.status,
      'generated_at', rep.generated_at,
      'pdf_file_url', rep.pdf_file_url,
      'pdf_file_name', rep.pdf_file_name
    ),
    'service_order', jsonb_build_object(
      'id', so.id,
      'service_order_number', so.service_order_number,
      'title', so.title,
      'description', so.description,
      'scheduled_date', so.scheduled_date,
      'started_at', so.started_at,
      'completed_at', so.completed_at,
      'technician_report', so.technician_report,
      'issue_found', so.issue_found,
      'solution_applied', so.solution_applied
    ),
    'customer', to_jsonb(cust),
    'company', to_jsonb(comp),
    'address', to_jsonb(addr),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'description', i.description,
        'item_type', i.item_type, 'planned_quantity', i.planned_quantity,
        'used_quantity', i.used_quantity, 'unit', i.unit, 'position', i.position
      ) ORDER BY i.position)
      FROM public.service_order_items i WHERE i.service_order_id = so.id
    ), '[]'::jsonb),
    'materials', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.name, 'quantity', m.quantity, 'unit', m.unit
      ))
      FROM public.service_order_material_usage m WHERE m.service_order_id = so.id
    ), '[]'::jsonb),
    'checklist', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'is_required', c.is_required,
        'is_completed', c.is_completed, 'position', c.position
      ) ORDER BY c.position)
      FROM public.service_order_checklist_items c WHERE c.service_order_id = so.id
    ), '[]'::jsonb),
    'signatures', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'signature_type', s.signature_type,
        'signer_name', s.signer_name, 'signed_at', s.signed_at,
        'signature_file_url', s.signature_file_url
      ))
      FROM public.service_order_signatures s WHERE s.service_order_id = so.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'storage_path', p.storage_path, 'caption', p.caption,
        'taken_at', p.taken_at
      ))
      FROM public.service_order_photos p WHERE p.service_order_id = so.id
    ), '[]'::jsonb)
  );

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_public_so_report(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_so_report(TEXT) TO anon, authenticated, service_role;
