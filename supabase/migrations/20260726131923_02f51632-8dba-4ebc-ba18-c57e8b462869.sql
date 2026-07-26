-- D3.1: Idempotência create_service_order_from_project

-- 1) COLUNA client_request_id com drift-guard
DO $$
DECLARE v_type text; v_nullable text;
BEGIN
  SELECT data_type, is_nullable INTO v_type, v_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='service_orders' AND column_name='client_request_id';
  IF NOT FOUND THEN
    ALTER TABLE public.service_orders ADD COLUMN client_request_id uuid NULL;
  ELSIF v_type <> 'uuid' OR v_nullable <> 'YES' THEN
    RAISE EXCEPTION 'Drift: client_request_id incompatível. Tipo=%, nullable=%', v_type, v_nullable;
  END IF;
END $$;

-- 2) INDEX drift-guard
DO $$
DECLARE v_indexdef text;
BEGIN
  SELECT indexdef INTO v_indexdef FROM pg_indexes
  WHERE schemaname='public' AND indexname='service_orders_company_client_request_uidx';
  IF v_indexdef IS NULL THEN
    CREATE UNIQUE INDEX service_orders_company_client_request_uidx
      ON public.service_orders(company_id, client_request_id)
      WHERE client_request_id IS NOT NULL;
  ELSIF v_indexdef !~* 'UNIQUE INDEX'
     OR v_indexdef !~* 'ON public\.service_orders'
     OR v_indexdef !~* '\(company_id, client_request_id\)'
     OR v_indexdef !~* 'WHERE \(client_request_id IS NOT NULL\)'
  THEN
    RAISE EXCEPTION 'Drift: índice service_orders_company_client_request_uidx incompatível: %', v_indexdef;
  END IF;
END $$;

-- 3) DROP da assinatura antiga (2 args) e criação da nova (3 args)
DROP FUNCTION IF EXISTS public.create_service_order_from_project(uuid, uuid);

CREATE FUNCTION public.create_service_order_from_project(
  _project_id uuid,
  _assigned_technician_id uuid DEFAULT NULL,
  _client_request_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  target_company_id UUID;
  p RECORD;
  so_id UUID;
  so_num TEXT;
  tpl_id UUID;
  tech_id UUID;
  items_added INTEGER := 0;
  existing_project_id UUID;
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

  target_company_id := p.company_id;

  -- Idempotência: buscar OS existente com a mesma chave dentro da empresa do projeto
  IF _client_request_id IS NOT NULL THEN
    SELECT id, project_id INTO so_id, existing_project_id
      FROM public.service_orders
      WHERE company_id = target_company_id AND client_request_id = _client_request_id
      LIMIT 1;
    IF so_id IS NOT NULL THEN
      IF existing_project_id <> _project_id THEN
        RAISE EXCEPTION 'client_request_id já utilizado em outro projeto.';
      END IF;
      RETURN so_id;
    END IF;
  END IF;

  tech_id := COALESCE(_assigned_technician_id, p.responsible_user_id);
  IF tech_id IS NULL THEN
    RAISE EXCEPTION 'Defina um técnico responsável para a OS ou um responsável no projeto.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = tech_id AND company_id = target_company_id
  ) THEN
    RAISE EXCEPTION 'Técnico selecionado não pertence à sua empresa.';
  END IF;

  so_num := public.next_service_order_number(target_company_id);

  BEGIN
    INSERT INTO public.service_orders(
      company_id, project_id, quote_id, customer_id, customer_address_id, customer_contact_id,
      service_order_number, title, description, status, priority,
      assigned_technician_id, responsible_user_id,
      scheduled_date, scheduled_start_time, scheduled_end_time,
      customer_instructions, access_instructions, parking_instructions,
      technical_notes, created_by, client_request_id
    ) VALUES (
      target_company_id, p.id, p.quote_id, p.customer_id, p.customer_address_id, p.customer_contact_id,
      so_num, COALESCE(NULLIF(p.title,''), 'OS ' || p.project_number), p.description,
      'SCHEDULED', COALESCE(p.priority, 'NORMAL'),
      tech_id, COALESCE(p.responsible_user_id, tech_id),
      p.planned_start_date, p.planned_start_time, p.planned_end_time,
      p.customer_instructions, p.access_instructions, p.parking_instructions,
      p.operational_notes, uid, _client_request_id
    ) RETURNING id INTO so_id;
  EXCEPTION WHEN unique_violation THEN
    IF _client_request_id IS NULL THEN RAISE; END IF;
    SELECT id, project_id INTO so_id, existing_project_id
      FROM public.service_orders
      WHERE company_id = target_company_id AND client_request_id = _client_request_id
      LIMIT 1;
    IF so_id IS NULL THEN RAISE; END IF;
    IF existing_project_id <> _project_id THEN
      RAISE EXCEPTION 'client_request_id já utilizado em outro projeto.';
    END IF;
    RETURN so_id;
  END;

  INSERT INTO public.service_order_items(
    company_id, service_order_id, project_item_id, item_id, item_type,
    name, description, image_url, planned_quantity, unit, position
  )
  SELECT target_company_id, so_id, pi.id, pi.item_id, COALESCE(pi.item_type,'PRODUCT'),
         pi.name, pi.description, pi.image_url, pi.quantity, COALESCE(pi.unit,'UN'), pi.position
  FROM public.project_items pi
  WHERE pi.project_id = _project_id;

  SELECT id INTO tpl_id
    FROM public.service_order_checklist_templates
    WHERE company_id = target_company_id AND active = true
    ORDER BY created_at ASC LIMIT 1;
  IF tpl_id IS NOT NULL THEN
    INSERT INTO public.service_order_checklist_items(
      company_id, service_order_id, title, description, required, sort_order
    )
    SELECT target_company_id, so_id, ti.title, ti.description, ti.required, ti.sort_order
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
    jsonb_build_object(
      'project_id', _project_id,
      'service_order_number', so_num,
      'assigned_technician_id', tech_id,
      'client_request_id', _client_request_id
    ));
  PERFORM public.log_activity(format('OS %s criada a partir do projeto %s.', so_num, p.project_number));
  PERFORM public.notify_user(uid, target_company_id, 'Ordem de Serviço criada',
    format('OS %s criada a partir do projeto %s.', so_num, p.project_number));
  IF tech_id IS NOT NULL AND tech_id <> uid THEN
    PERFORM public.notify_user(tech_id, target_company_id, 'Você é técnico de uma OS',
      format('OS %s foi agendada para você.', so_num));
  END IF;

  RETURN so_id;
END $function$;

-- 4) GRANTS: sem PUBLIC/anon
REVOKE ALL ON FUNCTION public.create_service_order_from_project(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_service_order_from_project(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_order_from_project(uuid, uuid, uuid) TO service_role;

-- 5) Validar assinatura única
DO $$
BEGIN
  IF to_regprocedure('public.create_service_order_from_project(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'A assinatura antiga de dois argumentos ainda existe.';
  END IF;
  IF to_regprocedure('public.create_service_order_from_project(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'A nova assinatura de três argumentos não foi criada.';
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE proname='create_service_order_from_project'
        AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'Deve existir exatamente uma assinatura de create_service_order_from_project.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';