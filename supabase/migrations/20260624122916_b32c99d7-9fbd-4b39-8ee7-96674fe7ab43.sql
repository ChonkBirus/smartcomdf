
-- 1. Add columns to execution logs
ALTER TABLE public.service_order_execution_logs
  ADD COLUMN IF NOT EXISTS previous_status text,
  ADD COLUMN IF NOT EXISTS new_status text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Expand action check to include STATUS_CHANGED
ALTER TABLE public.service_order_execution_logs
  DROP CONSTRAINT IF EXISTS service_order_execution_logs_action_check;
ALTER TABLE public.service_order_execution_logs
  ADD CONSTRAINT service_order_execution_logs_action_check
  CHECK (action = ANY (ARRAY[
    'STARTED','PAUSED','RESUMED','FINISHED_EXECUTION',
    'STATUS_CHANGED','NOTE_ADDED',
    'CHECKLIST_UPDATED','PHOTO_ADDED','MATERIAL_ADDED','MATERIAL_UPDATED'
  ]));

-- 3. Transactional RPC for execution actions
CREATE OR REPLACE FUNCTION public.service_order_execute_transition(
  _so_id uuid,
  _action text,
  _reason text DEFAULT NULL,
  _technician_report text DEFAULT NULL,
  _issue_found text DEFAULT NULL,
  _solution_applied text DEFAULT NULL
)
RETURNS public.service_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_so public.service_orders;
  v_uid uuid := auth.uid();
  v_company uuid := public.current_company_id();
  v_is_manager boolean;
  v_new_status text;
  v_action_label text;
  v_notify_msg text;
  v_perm_slug text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_so FROM public.service_orders WHERE id = _so_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Serviço não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_so.company_id <> v_company AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem acesso a esta Ordem de Serviço.' USING ERRCODE = '42501';
  END IF;

  v_is_manager :=
       public.is_super_admin()
    OR public.has_company_role('owner')
    OR public.has_permission('service_orders.edit')
    OR public.has_permission('service_orders.assign_technician');

  IF NOT v_is_manager AND v_so.assigned_technician_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Você não tem permissão para executar esta Ordem de Serviço.' USING ERRCODE = '42501';
  END IF;

  -- Decide transition + validations
  IF _action = 'STARTED' THEN
    v_perm_slug := 'service_orders.start';
    IF v_so.status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Esta Ordem de Serviço não pode ser iniciada porque está cancelada.';
    ELSIF v_so.status = 'COMPLETED' THEN
      RAISE EXCEPTION 'Esta Ordem de Serviço já foi concluída.';
    ELSIF v_so.status <> 'SCHEDULED' THEN
      RAISE EXCEPTION 'Somente Ordens de Serviço agendadas podem ser iniciadas.';
    END IF;
    IF v_so.assigned_technician_id IS NULL AND NOT v_is_manager THEN
      RAISE EXCEPTION 'OS sem técnico atribuído. Solicite a um gestor.';
    END IF;
    v_new_status := 'IN_PROGRESS';
    v_action_label := 'iniciou atendimento';
    v_notify_msg := 'Técnico iniciou atendimento da OS #' || v_so.service_order_number;

  ELSIF _action = 'PAUSED' THEN
    v_perm_slug := 'service_orders.pause';
    IF v_so.status <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'Somente Ordens de Serviço em andamento podem ser pausadas.';
    END IF;
    IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo da pausa.';
    END IF;
    v_new_status := 'PAUSED';
    v_action_label := 'pausou atendimento';
    v_notify_msg := 'Técnico pausou atendimento da OS #' || v_so.service_order_number;

  ELSIF _action = 'RESUMED' THEN
    v_perm_slug := 'service_orders.start';
    IF v_so.status <> 'PAUSED' THEN
      RAISE EXCEPTION 'Somente Ordens de Serviço pausadas podem ser retomadas.';
    END IF;
    v_new_status := 'IN_PROGRESS';
    v_action_label := 'retomou atendimento';
    v_notify_msg := 'Técnico retomou atendimento da OS #' || v_so.service_order_number;

  ELSIF _action = 'FINISHED_EXECUTION' THEN
    v_perm_slug := 'service_orders.finish_execution';
    IF v_so.status = 'COMPLETED' THEN
      RAISE EXCEPTION 'Esta Ordem de Serviço já foi concluída.';
    ELSIF v_so.status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Esta Ordem de Serviço está cancelada.';
    ELSIF v_so.status <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'Somente Ordens de Serviço em andamento podem ser finalizadas.';
    END IF;
    IF _technician_report IS NULL OR length(btrim(_technician_report)) = 0 THEN
      RAISE EXCEPTION 'Informe o relatório técnico antes de finalizar.';
    END IF;
    v_new_status := 'COMPLETED';
    v_action_label := 'finalizou execução técnica';
    v_notify_msg := 'Técnico finalizou execução técnica da OS #' || v_so.service_order_number;
  ELSE
    RAISE EXCEPTION 'Ação inválida: %', _action;
  END IF;

  -- Permission check (managers bypass via has_permission/role)
  IF v_perm_slug IS NOT NULL
     AND NOT v_is_manager
     AND NOT public.has_permission(v_perm_slug)
     AND NOT public.has_permission('service_orders.execute') THEN
    RAISE EXCEPTION 'Você não tem permissão para executar esta ação.' USING ERRCODE = '42501';
  END IF;

  -- Apply update
  UPDATE public.service_orders SET
    status = v_new_status,
    started_at = CASE WHEN _action = 'STARTED' AND started_at IS NULL THEN now() ELSE started_at END,
    execution_started_by = CASE WHEN _action = 'STARTED' AND execution_started_by IS NULL THEN v_uid ELSE execution_started_by END,
    completed_at = CASE WHEN _action = 'FINISHED_EXECUTION' THEN now() ELSE completed_at END,
    execution_completed_by = CASE WHEN _action = 'FINISHED_EXECUTION' THEN v_uid ELSE execution_completed_by END,
    technician_report = CASE WHEN _action = 'FINISHED_EXECUTION' THEN _technician_report ELSE technician_report END,
    issue_found = CASE WHEN _action = 'FINISHED_EXECUTION' AND _issue_found IS NOT NULL THEN _issue_found ELSE issue_found END,
    solution_applied = CASE WHEN _action = 'FINISHED_EXECUTION' AND _solution_applied IS NOT NULL THEN _solution_applied ELSE solution_applied END,
    pending_reason = CASE
      WHEN _action = 'PAUSED' THEN _reason
      WHEN _action = 'RESUMED' THEN NULL
      ELSE pending_reason
    END,
    updated_at = now()
  WHERE id = _so_id
  RETURNING * INTO v_so;

  -- Execution log
  INSERT INTO public.service_order_execution_logs(
    company_id, service_order_id, user_id, action, previous_status, new_status, notes, metadata
  ) VALUES (
    v_so.company_id, v_so.id, v_uid, _action,
    CASE WHEN _action = 'STARTED' THEN 'SCHEDULED'
         WHEN _action = 'PAUSED' THEN 'IN_PROGRESS'
         WHEN _action = 'RESUMED' THEN 'PAUSED'
         WHEN _action = 'FINISHED_EXECUTION' THEN 'IN_PROGRESS'
    END,
    v_new_status,
    COALESCE(_reason, _technician_report),
    jsonb_strip_nulls(jsonb_build_object(
      'reason', _reason,
      'technician_report', _technician_report,
      'issue_found', _issue_found,
      'solution_applied', _solution_applied
    ))
  );

  -- Audit log
  INSERT INTO public.audit_logs(company_id, user_id, action, module, record_id, new_data)
  VALUES (
    v_so.company_id, v_uid, _action, 'service_orders', v_so.id::text,
    jsonb_build_object('status', v_new_status, 'reason', _reason, 'report', _technician_report)
  );

  -- Activity log
  INSERT INTO public.activity_logs(company_id, user_id, description)
  VALUES (
    v_so.company_id, v_uid,
    'Técnico ' || v_action_label || ' da OS #' || v_so.service_order_number
  );

  -- Internal notification (broadcast to company: user_id NULL)
  INSERT INTO public.notifications(company_id, user_id, title, message)
  VALUES (
    v_so.company_id, NULL,
    'OS #' || v_so.service_order_number,
    v_notify_msg || COALESCE(' — ' || _reason, '')
  );

  RETURN v_so;
END;
$$;

REVOKE ALL ON FUNCTION public.service_order_execute_transition(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_order_execute_transition(uuid,text,text,text,text,text) TO authenticated;
