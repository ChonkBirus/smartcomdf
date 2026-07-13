
CREATE OR REPLACE FUNCTION public.convert_quote_to_project(_quote_id uuid, _responsible_user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  q RECORD;
  pid UUID;
  pnum TEXT;
  addr_id UUID;
  cont_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Sem empresa.'; END IF;

  IF NOT (public.is_super_admin() OR public.has_company_role('owner')
          OR public.has_permission('projects.convert_from_quote')) THEN
    RAISE EXCEPTION 'Sem permissão para converter orçamento em projeto.';
  END IF;

  -- Pré-check idempotente: se já existe projeto p/ este quote nesta empresa, retorna-o.
  SELECT p.id INTO pid
  FROM public.projects p
  WHERE p.quote_id = _quote_id AND p.company_id = cid
  LIMIT 1;
  IF pid IS NOT NULL THEN
    RETURN pid;
  END IF;

  SELECT * INTO q FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.'; END IF;
  IF q.company_id <> cid THEN RAISE EXCEPTION 'Orçamento de outra empresa.'; END IF;

  -- Re-check pós-lock: outra transação concorrente pode ter criado enquanto esperávamos.
  SELECT p.id INTO pid
  FROM public.projects p
  WHERE p.quote_id = q.id AND p.company_id = cid
  LIMIT 1;
  IF pid IS NOT NULL THEN
    RETURN pid;
  END IF;

  IF q.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Somente orçamentos aprovados podem ser convertidos em projeto.';
  END IF;
  IF q.payment_status <> 'PAYMENT_APPROVED'
     AND COALESCE(q.financial_status, 'UNPAID') NOT IN ('PARTIALLY_PAID', 'PAID') THEN
    RAISE EXCEPTION 'Este orçamento foi aprovado, mas ainda está aguardando pagamento da entrada.';
  END IF;

  IF _responsible_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _responsible_user_id AND company_id = cid
    ) THEN
      RAISE EXCEPTION 'Responsável selecionado não pertence à sua empresa.';
    END IF;
  END IF;

  SELECT id INTO addr_id FROM public.customer_addresses
    WHERE customer_id = q.customer_id ORDER BY is_primary DESC, created_at ASC LIMIT 1;
  SELECT id INTO cont_id FROM public.customer_contacts
    WHERE customer_id = q.customer_id ORDER BY is_primary DESC, created_at ASC LIMIT 1;

  pnum := public.next_project_number(cid);

  BEGIN
    INSERT INTO public.projects(
      company_id, quote_id, customer_id, customer_address_id, customer_contact_id,
      project_number, title, description, status, priority,
      total_amount, down_payment_amount, remaining_amount,
      completion_estimate, notes, created_by, responsible_user_id
    ) VALUES (
      cid, q.id, q.customer_id, addr_id, cont_id,
      pnum, COALESCE(NULLIF(q.title,''), 'Projeto ' || q.quote_number),
      q.customer_notes, 'READY_TO_SCHEDULE', 'NORMAL',
      COALESCE(q.total_amount,0), COALESCE(q.down_payment_amount,0), COALESCE(q.remaining_amount,0),
      q.completion_estimate, q.customer_notes, uid, _responsible_user_id
    ) RETURNING id INTO pid;
  EXCEPTION WHEN unique_violation THEN
    -- Concorrência: outra chamada inseriu antes. Retorna o projeto existente.
    SELECT p.id INTO pid
    FROM public.projects p
    WHERE p.quote_id = q.id AND p.company_id = cid
    LIMIT 1;
    IF pid IS NULL THEN
      RAISE;
    END IF;
    RETURN pid;
  END;

  INSERT INTO public.project_items(
    company_id, project_id, quote_item_id, item_id, item_type,
    name, description, image_url, quantity, unit, position
  )
  SELECT
    cid, pid, qi.id, qi.item_id, COALESCE(qi.kind::text, 'PRODUCT'),
    qi.name, qi.description,
    (SELECT ii.file_url FROM public.item_images ii
       WHERE ii.item_id = qi.item_id
       ORDER BY ii.is_primary DESC, ii.created_at ASC LIMIT 1),
    qi.quantity, COALESCE(it.unit::text,'UN'), qi.position
  FROM public.quote_items qi
  LEFT JOIN public.items it ON it.id = qi.item_id
  WHERE qi.quote_id = q.id AND qi.kind <> 'LABOR';

  UPDATE public.quotes SET converted_at = now() WHERE id = q.id;

  PERFORM public.log_audit('projects','create', pid, NULL,
    jsonb_build_object('quote_id', q.id, 'project_number', pnum,
                       'responsible_user_id', _responsible_user_id));
  PERFORM public.log_activity(format('Orçamento %s convertido em projeto %s.', q.quote_number, pnum));
  PERFORM public.notify_user(uid, cid, 'Projeto criado',
    format('Projeto %s criado a partir do orçamento %s.', pnum, q.quote_number));

  RETURN pid;
END
$function$;

GRANT EXECUTE ON FUNCTION public.convert_quote_to_project(uuid, uuid) TO authenticated;
