
CREATE OR REPLACE FUNCTION public.create_service_order_from_project(
  _project_id uuid,
  _assigned_technician_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  p RECORD;
  so_id UUID;
  so_num TEXT;
  tpl_id UUID;
  tech_id UUID;
  items_added INTEGER := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Sem empresa.'; END IF;

  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('service_orders.create')) THEN
    RAISE EXCEPTION 'Sem permissão para criar Ordem de Serviço.';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  IF p.company_id <> cid AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Projeto de outra empresa.';
  END IF;
  IF p.status = 'CANCELLED' THEN RAISE EXCEPTION 'Projeto cancelado não pode gerar OS.'; END IF;
  IF p.status = 'COMPLETED' THEN RAISE EXCEPTION 'Projeto concluído não pode gerar OS.'; END IF;
  IF p.planning_status <> 'READY_FOR_SERVICE_ORDER' THEN
    RAISE EXCEPTION 'Finalize o planejamento antes de gerar a Ordem de Serviço.';
  END IF;
  IF p.planned_start_date IS NULL THEN RAISE EXCEPTION 'Projeto sem data prevista.'; END IF;

  tech_id := COALESCE(_assigned_technician_id, p.responsible_user_id);
  IF tech_id IS NULL THEN
    RAISE EXCEPTION 'Defina um técnico responsável para a OS ou um responsável no projeto.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = tech_id AND company_id = p.company_id
  ) THEN
    RAISE EXCEPTION 'Técnico selecionado não pertence à sua empresa.';
  END IF;

  -- PR3: projetos podem ter várias OS (bloqueio de OS única removido).

  so_num := public.next_service_order_number(p.company_id);

  INSERT INTO public.service_orders(
    company_id, project_id, quote_id, customer_id, customer_address_id, customer_contact_id,
    service_order_number, title, description, status, priority,
    assigned_technician_id, responsible_user_id,
    scheduled_date, scheduled_start_time, scheduled_end_time,
    customer_instructions, access_instructions, parking_instructions,
    technical_notes, created_by
  ) VALUES (
    p.company_id, p.id, p.quote_id, p.customer_id, p.customer_address_id, p.customer_contact_id,
    so_num, COALESCE(NULLIF(p.title,''), 'OS ' || p.project_number), p.description,
    'SCHEDULED', COALESCE(p.priority, 'NORMAL'),
    tech_id, COALESCE(p.responsible_user_id, tech_id),
    p.planned_start_date, p.planned_start_time, p.planned_end_time,
    p.customer_instructions, p.access_instructions, p.parking_instructions,
    p.operational_notes, uid
  ) RETURNING id INTO so_id;

  INSERT INTO public.service_order_items(
    company_id, service_order_id, project_item_id, item_id, item_type,
    name, description, image_url, planned_quantity, unit, position
  )
  SELECT p.company_id, so_id, pi.id, pi.item_id, COALESCE(pi.item_type,'PRODUCT'),
         pi.name, pi.description, pi.image_url, pi.quantity, COALESCE(pi.unit,'UN'), pi.position
  FROM public.project_items pi
  WHERE pi.project_id = _project_id;

  SELECT id INTO tpl_id
    FROM public.service_order_checklist_templates
    WHERE company_id = p.company_id AND active = true
    ORDER BY created_at ASC LIMIT 1;
  IF tpl_id IS NOT NULL THEN
    INSERT INTO public.service_order_checklist_items(
      company_id, service_order_id, title, description, required, sort_order
    )
    SELECT p.company_id, so_id, ti.title, ti.description, ti.required, ti.sort_order
    FROM public.service_order_checklist_template_items ti
    WHERE ti.template_id = tpl_id AND ti.active = true
    ORDER BY ti.sort_order, ti.created_at;
  END IF;

  SELECT COUNT(*) INTO items_added
    FROM public.service_order_checklist_items WHERE service_order_id = so_id;
  IF items_added = 0 THEN
    PERFORM public.generate_smart_service_order_checklist(so_id);
  END IF;

  UPDATE public.projects SET
    status = CASE WHEN status = 'READY_TO_SCHEDULE' THEN 'SCHEDULED' ELSE status END,
    updated_at = now()
  WHERE id = _project_id;

  PERFORM public.log_audit('service_orders','create', so_id, NULL,
    jsonb_build_object('project_id', _project_id, 'service_order_number', so_num,
                       'assigned_technician_id', tech_id));
  PERFORM public.log_activity(format('OS %s criada a partir do projeto %s.', so_num, p.project_number));
  PERFORM public.notify_user(uid, p.company_id, 'Ordem de Serviço criada',
    format('OS %s criada a partir do projeto %s.', so_num, p.project_number));
  IF tech_id IS NOT NULL AND tech_id <> uid THEN
    PERFORM public.notify_user(tech_id, p.company_id, 'Você é técnico de uma OS',
      format('OS %s foi agendada para você.', so_num));
  END IF;

  RETURN so_id;
END $function$;
