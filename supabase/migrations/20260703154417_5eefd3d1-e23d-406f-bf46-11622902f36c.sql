
-- Smart checklist generator based on project description + service order items.
CREATE OR REPLACE FUNCTION public.generate_smart_service_order_checklist(_so_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  so RECORD;
  proj RECORD;
  haystack TEXT;
  categories TEXT[] := ARRAY[]::TEXT[];
  inserted_count INTEGER := 0;
  next_order INTEGER;
  cat TEXT;
BEGIN
  SELECT * INTO so FROM public.service_orders WHERE id = _so_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO proj FROM public.projects WHERE id = so.project_id;

  -- Build haystack: project description, title, operational notes, item names.
  haystack := lower(
    COALESCE(so.title,'') || ' ' ||
    COALESCE(so.description,'') || ' ' ||
    COALESCE(so.technical_notes,'') || ' ' ||
    COALESCE(so.customer_instructions,'') || ' ' ||
    COALESCE(proj.description,'') || ' ' ||
    COALESCE(proj.operational_notes,'') || ' ' ||
    COALESCE((
      SELECT string_agg(COALESCE(name,'') || ' ' || COALESCE(description,''), ' ')
      FROM public.service_order_items WHERE service_order_id = _so_id
    ), '')
  );
  -- Normalize accents to make matching resilient.
  haystack := translate(haystack,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');

  IF haystack ~ '(cftv|camera|dvr|nvr|monitoramento|vigilancia)' THEN
    categories := array_append(categories, 'CFTV');
  END IF;
  IF haystack ~ '(alarme|sensor|sirene|central de alarme)' THEN
    categories := array_append(categories, 'ALARME');
  END IF;
  IF haystack ~ '(controle de acesso|biometr|facial|catraca|fechadura|eletroima|cartao de acesso)' THEN
    categories := array_append(categories, 'ACESSO');
  END IF;
  IF haystack ~ '(interfone|porteiro|interfonia|ramal)' THEN
    categories := array_append(categories, 'INTERFONIA');
  END IF;
  IF haystack ~ '(wifi|wi-fi|rede|roteador|switch|access point|\bap\b|rack|cabeamento estruturado)' THEN
    categories := array_append(categories, 'REDE');
  END IF;
  IF haystack ~ '(manutencao|reparo|conserto|diagnostico|revisao)' THEN
    categories := array_append(categories, 'MANUTENCAO');
  END IF;

  IF array_length(categories, 1) IS NULL THEN
    categories := ARRAY['GENERICO'];
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO next_order
    FROM public.service_order_checklist_items WHERE service_order_id = _so_id;

  FOREACH cat IN ARRAY categories LOOP
    IF cat = 'CFTV' THEN
      INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
      SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
      FROM unnest(ARRAY[
        'Confirmar pontos de instalação com o cliente',
        'Verificar passagem de cabos',
        'Instalar câmeras nos locais definidos',
        'Fixar e ajustar ângulo das câmeras',
        'Conectar câmeras ao DVR/NVR',
        'Configurar gravação',
        'Testar visualização local e remota',
        'Orientar cliente sobre uso do aplicativo'
      ]) t
      ON CONFLICT DO NOTHING;
    ELSIF cat = 'ALARME' THEN
      INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
      SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
      FROM unnest(ARRAY[
        'Validar pontos de sensores',
        'Instalar central de alarme',
        'Instalar sensores e sirene',
        'Configurar zonas',
        'Testar disparo',
        'Configurar aplicativo/monitoramento',
        'Orientar cliente sobre uso'
      ]) t
      ON CONFLICT DO NOTHING;
    ELSIF cat = 'ACESSO' THEN
      INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
      SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
      FROM unnest(ARRAY[
        'Conferir pontos de acesso',
        'Instalar equipamento (facial/biométrico/cartão)',
        'Configurar usuários de teste',
        'Testar abertura e fechamento',
        'Verificar fechadura/eletroímã',
        'Configurar regras de acesso',
        'Orientar responsável pelo local'
      ]) t
      ON CONFLICT DO NOTHING;
    ELSIF cat = 'INTERFONIA' THEN
      INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
      SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
      FROM unnest(ARRAY[
        'Conferir ramais/pontos',
        'Verificar cabeamento',
        'Instalar módulo/porteiro/interfone',
        'Configurar chamada',
        'Testar comunicação',
        'Testar abertura de fechadura (se houver)',
        'Orientar usuário'
      ]) t
      ON CONFLICT DO NOTHING;
    ELSIF cat = 'REDE' THEN
      INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
      SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
      FROM unnest(ARRAY[
        'Conferir infraestrutura existente',
        'Testar ponto de internet',
        'Instalar rack/switch/AP (se aplicável)',
        'Organizar cabeamento',
        'Configurar rede/Wi-Fi',
        'Testar velocidade e cobertura',
        'Identificar pontos'
      ]) t
      ON CONFLICT DO NOTHING;
    ELSIF cat = 'MANUTENCAO' THEN
      INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
      SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
      FROM unnest(ARRAY[
        'Diagnosticar problema relatado',
        'Verificar equipamentos existentes',
        'Testar alimentação e conexões',
        'Corrigir falha encontrada',
        'Testar funcionamento final',
        'Informar cliente sobre causa e solução'
      ]) t
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
      SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
      FROM unnest(ARRAY[
        'Confirmar necessidade com o cliente',
        'Conferir local de execução',
        'Separar materiais necessários',
        'Executar serviço contratado',
        'Testar funcionamento'
      ]) t
      ON CONFLICT DO NOTHING;
    END IF;

    SELECT COALESCE(MAX(sort_order), -1) + 1 INTO next_order
      FROM public.service_order_checklist_items WHERE service_order_id = _so_id;
  END LOOP;

  -- Common closing items.
  INSERT INTO public.service_order_checklist_items(company_id, service_order_id, title, required, sort_order)
  SELECT so.company_id, _so_id, t, true, next_order + (row_number() OVER () - 1)::int
  FROM unnest(ARRAY[
    'Registrar fotos antes/depois',
    'Coletar aceite/assinatura do cliente'
  ]) t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.service_order_checklist_items
    WHERE service_order_id = _so_id AND title = t
  );

  SELECT COUNT(*) INTO inserted_count
    FROM public.service_order_checklist_items WHERE service_order_id = _so_id;
  RETURN inserted_count;
END $$;

-- Wire into the existing create_service_order_from_project RPC:
-- keep the template path, but fall back to smart generator when no template exists.
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

  IF EXISTS (
    SELECT 1 FROM public.service_orders
    WHERE project_id = _project_id AND status NOT IN ('CANCELLED')
  ) THEN
    RAISE EXCEPTION 'Já existe Ordem de Serviço ativa para este projeto.';
  END IF;

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

  -- If no checklist yet, fall back to smart generator based on scope/items.
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
