
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_start_date DATE,
  ADD COLUMN IF NOT EXISTS planned_end_date DATE,
  ADD COLUMN IF NOT EXISTS planned_start_time TIME,
  ADD COLUMN IF NOT EXISTS planned_end_time TIME,
  ADD COLUMN IF NOT EXISTS operational_notes TEXT,
  ADD COLUMN IF NOT EXISTS customer_instructions TEXT,
  ADD COLUMN IF NOT EXISTS access_instructions TEXT,
  ADD COLUMN IF NOT EXISTS parking_instructions TEXT,
  ADD COLUMN IF NOT EXISTS material_status TEXT NOT NULL DEFAULT 'NOT_CHECKED',
  ADD COLUMN IF NOT EXISTS planning_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS materials_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_for_os_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_material_status_check;
  ALTER TABLE public.projects ADD CONSTRAINT projects_material_status_check
    CHECK (material_status IN ('NOT_CHECKED','AVAILABLE','PARTIALLY_AVAILABLE','UNAVAILABLE','RESERVED'));
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_planning_status_check;
  ALTER TABLE public.projects ADD CONSTRAINT projects_planning_status_check
    CHECK (planning_status IN ('PENDING','IN_PROGRESS','READY_FOR_SERVICE_ORDER'));
END $$;

CREATE TABLE IF NOT EXISTS public.project_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ptm_unique ON public.project_team_members(project_id, user_id, COALESCE(role, ''));
CREATE INDEX IF NOT EXISTS idx_ptm_project ON public.project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_ptm_company ON public.project_team_members(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_team_members TO authenticated;
GRANT ALL ON public.project_team_members TO service_role;
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ptm_select_own_company" ON public.project_team_members FOR SELECT TO authenticated
  USING (company_id = current_company_id() OR is_super_admin());
CREATE POLICY "ptm_insert_own_company" ON public.project_team_members FOR INSERT TO authenticated
  WITH CHECK (company_id = current_company_id());
CREATE POLICY "ptm_update_own_company" ON public.project_team_members FOR UPDATE TO authenticated
  USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id());
CREATE POLICY "ptm_delete_own_company" ON public.project_team_members FOR DELETE TO authenticated
  USING (company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.project_material_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_item_id UUID NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  required_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  available_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  missing_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  stock_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('AVAILABLE','PARTIALLY_AVAILABLE','UNAVAILABLE','NOT_APPLICABLE')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_item_id)
);
CREATE INDEX IF NOT EXISTS idx_pmc_project ON public.project_material_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_pmc_company ON public.project_material_checks(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_material_checks TO authenticated;
GRANT ALL ON public.project_material_checks TO service_role;
ALTER TABLE public.project_material_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmc_select_own_company" ON public.project_material_checks FOR SELECT TO authenticated
  USING (company_id = current_company_id() OR is_super_admin());
CREATE POLICY "pmc_insert_own_company" ON public.project_material_checks FOR INSERT TO authenticated
  WITH CHECK (company_id = current_company_id());
CREATE POLICY "pmc_update_own_company" ON public.project_material_checks FOR UPDATE TO authenticated
  USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id());
CREATE POLICY "pmc_delete_own_company" ON public.project_material_checks FOR DELETE TO authenticated
  USING (company_id = current_company_id());

CREATE TRIGGER trg_pmc_updated_at BEFORE UPDATE ON public.project_material_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions(slug, module, action, description) VALUES
  ('projects.plan','projects','plan','Editar planejamento operacional do projeto'),
  ('projects.assign_responsible','projects','assign_responsible','Atribuir responsável a um projeto'),
  ('projects.manage_team','projects','manage_team','Adicionar e remover membros da equipe'),
  ('projects.check_materials','projects','check_materials','Consultar disponibilidade de materiais'),
  ('projects.mark_ready_for_os','projects','mark_ready_for_os','Marcar projeto como pronto para Ordem de Serviço')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_project_planning(
  _id UUID,
  _responsible_user_id UUID DEFAULT NULL,
  _planned_start_date DATE DEFAULT NULL,
  _planned_end_date DATE DEFAULT NULL,
  _planned_start_time TIME DEFAULT NULL,
  _planned_end_time TIME DEFAULT NULL,
  _priority TEXT DEFAULT NULL,
  _operational_notes TEXT DEFAULT NULL,
  _customer_instructions TEXT DEFAULT NULL,
  _access_instructions TEXT DEFAULT NULL,
  _parking_instructions TEXT DEFAULT NULL,
  _clear_responsible BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid UUID := auth.uid(); cid UUID; p RECORD; old_data JSONB; new_data JSONB;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('projects.plan')) THEN
    RAISE EXCEPTION 'Sem permissão para planejar projetos.';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  IF p.company_id <> cid AND NOT public.is_super_admin() THEN RAISE EXCEPTION 'Projeto de outra empresa.'; END IF;
  IF p.status IN ('CANCELLED','COMPLETED') THEN
    RAISE EXCEPTION 'Projetos cancelados ou concluídos não podem ser planejados.';
  END IF;

  old_data := to_jsonb(p);
  UPDATE public.projects SET
    responsible_user_id = CASE WHEN _clear_responsible THEN NULL ELSE COALESCE(_responsible_user_id, responsible_user_id) END,
    planned_start_date = COALESCE(_planned_start_date, planned_start_date),
    planned_end_date = COALESCE(_planned_end_date, planned_end_date),
    planned_start_time = COALESCE(_planned_start_time, planned_start_time),
    planned_end_time = COALESCE(_planned_end_time, planned_end_time),
    priority = COALESCE(_priority, priority),
    operational_notes = COALESCE(_operational_notes, operational_notes),
    customer_instructions = COALESCE(_customer_instructions, customer_instructions),
    access_instructions = COALESCE(_access_instructions, access_instructions),
    parking_instructions = COALESCE(_parking_instructions, parking_instructions),
    planning_status = CASE WHEN planning_status = 'PENDING' THEN 'IN_PROGRESS' ELSE planning_status END,
    updated_at = now()
  WHERE id = _id;

  SELECT to_jsonb(pp) INTO new_data FROM public.projects pp WHERE id = _id;
  PERFORM public.log_audit('projects','planning_update', _id, old_data, new_data);
END $$;

CREATE OR REPLACE FUNCTION public.add_project_team_member(
  _project_id UUID, _user_id UUID, _role TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid UUID := auth.uid(); cid UUID; p RECORD; new_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('projects.manage_team')) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar equipe.';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF NOT FOUND OR (p.company_id <> cid AND NOT public.is_super_admin()) THEN RAISE EXCEPTION 'Projeto inválido.'; END IF;
  IF p.status IN ('CANCELLED','COMPLETED') THEN RAISE EXCEPTION 'Projeto não pode ser alterado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND company_id = p.company_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à empresa.';
  END IF;
  INSERT INTO public.project_team_members(company_id, project_id, user_id, role)
    VALUES (p.company_id, _project_id, _user_id, NULLIF(trim(_role),''))
    RETURNING id INTO new_id;
  PERFORM public.log_audit('projects','team_add', _project_id, NULL, jsonb_build_object('user_id', _user_id, 'role', _role));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.remove_project_team_member(_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid UUID := auth.uid(); cid UUID; m RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('projects.manage_team')) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  SELECT * INTO m FROM public.project_team_members WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;
  IF m.company_id <> cid AND NOT public.is_super_admin() THEN RAISE EXCEPTION 'Outra empresa.'; END IF;
  DELETE FROM public.project_team_members WHERE id = _id;
  PERFORM public.log_audit('projects','team_remove', m.project_id, jsonb_build_object('user_id', m.user_id, 'role', m.role), NULL);
END $$;

CREATE OR REPLACE FUNCTION public.check_project_materials(_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid UUID := auth.uid(); cid UUID; p RECORD; it RECORD;
  avail NUMERIC; missing NUMERIC; st TEXT;
  total_products INT := 0; available_count INT := 0; partial_count INT := 0; unavailable_count INT := 0;
  proj_status TEXT;
  controls BOOLEAN; itype TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('projects.check_materials')) THEN
    RAISE EXCEPTION 'Sem permissão para verificar materiais.';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF NOT FOUND OR (p.company_id <> cid AND NOT public.is_super_admin()) THEN RAISE EXCEPTION 'Projeto inválido.'; END IF;
  IF p.status IN ('CANCELLED','COMPLETED') THEN RAISE EXCEPTION 'Projeto não pode ser alterado.'; END IF;

  FOR it IN SELECT * FROM public.project_items WHERE project_id = _project_id LOOP
    controls := FALSE; itype := NULL; avail := 0; missing := 0; st := 'NOT_APPLICABLE';
    IF it.item_id IS NOT NULL THEN
      SELECT controls_stock, item_type::text INTO controls, itype FROM public.items WHERE id = it.item_id;
    END IF;
    IF it.item_id IS NULL OR NOT COALESCE(controls,FALSE) OR itype = 'SERVICE' OR it.item_type IN ('SERVICE','LABOR') THEN
      st := 'NOT_APPLICABLE';
    ELSE
      SELECT COALESCE(SUM(quantity),0) INTO avail
        FROM public.stock_balances WHERE company_id = p.company_id AND item_id = it.item_id;
      missing := GREATEST(0, it.quantity - avail);
      IF avail >= it.quantity THEN st := 'AVAILABLE'; available_count := available_count + 1;
      ELSIF avail > 0 THEN st := 'PARTIALLY_AVAILABLE'; partial_count := partial_count + 1;
      ELSE st := 'UNAVAILABLE'; unavailable_count := unavailable_count + 1;
      END IF;
      total_products := total_products + 1;
    END IF;

    INSERT INTO public.project_material_checks(
      company_id, project_id, project_item_id, item_id,
      required_quantity, available_quantity, missing_quantity, status, checked_at, checked_by
    ) VALUES (
      p.company_id, _project_id, it.id, it.item_id,
      it.quantity, avail, missing, st, now(), uid
    )
    ON CONFLICT (project_item_id) DO UPDATE SET
      required_quantity = EXCLUDED.required_quantity,
      available_quantity = EXCLUDED.available_quantity,
      missing_quantity = EXCLUDED.missing_quantity,
      status = EXCLUDED.status,
      checked_at = now(),
      checked_by = uid,
      updated_at = now();
  END LOOP;

  IF total_products = 0 THEN proj_status := 'NOT_CHECKED';
  ELSIF unavailable_count = total_products THEN proj_status := 'UNAVAILABLE';
  ELSIF available_count = total_products THEN proj_status := 'AVAILABLE';
  ELSE proj_status := 'PARTIALLY_AVAILABLE';
  END IF;

  UPDATE public.projects
    SET material_status = proj_status, materials_checked_at = now(), updated_at = now()
    WHERE id = _project_id;

  PERFORM public.log_audit('projects','materials_check', _project_id, NULL,
    jsonb_build_object('material_status', proj_status, 'available', available_count,
                       'partial', partial_count, 'unavailable', unavailable_count));

  IF unavailable_count > 0 OR partial_count > 0 THEN
    PERFORM public.notify_user(uid, p.company_id, 'Material insuficiente',
      format('Projeto %s possui materiais faltantes.', p.project_number));
  END IF;

  RETURN jsonb_build_object('material_status', proj_status,
    'available', available_count, 'partial', partial_count,
    'unavailable', unavailable_count, 'total_products', total_products);
END $$;

CREATE OR REPLACE FUNCTION public.mark_project_ready_for_os(_project_id UUID, _force BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid UUID := auth.uid(); cid UUID; p RECORD; has_team BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('projects.mark_ready_for_os')) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND OR (p.company_id <> cid AND NOT public.is_super_admin()) THEN RAISE EXCEPTION 'Projeto inválido.'; END IF;
  IF p.status IN ('CANCELLED','COMPLETED') THEN RAISE EXCEPTION 'Projeto não pode ser alterado.'; END IF;
  IF p.responsible_user_id IS NULL THEN RAISE EXCEPTION 'Defina o responsável pelo projeto.'; END IF;
  IF p.planned_start_date IS NULL THEN RAISE EXCEPTION 'Defina a previsão de início.'; END IF;
  IF p.planned_end_date IS NULL THEN RAISE EXCEPTION 'Defina a previsão de conclusão.'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.project_team_members WHERE project_id = _project_id) INTO has_team;
  IF NOT has_team THEN RAISE EXCEPTION 'Defina ao menos um membro da equipe.'; END IF;
  IF p.material_status = 'NOT_CHECKED' THEN RAISE EXCEPTION 'Verifique a disponibilidade de materiais antes.'; END IF;
  IF p.material_status IN ('UNAVAILABLE','PARTIALLY_AVAILABLE') AND NOT _force THEN
    RAISE EXCEPTION 'Existem materiais insuficientes. Confirme para continuar.';
  END IF;

  UPDATE public.projects SET
    planning_status = 'READY_FOR_SERVICE_ORDER',
    status = CASE WHEN status = 'READY_TO_SCHEDULE' THEN 'SCHEDULED' ELSE status END,
    ready_for_os_at = now(),
    updated_at = now()
  WHERE id = _project_id;

  PERFORM public.log_audit('projects','ready_for_os', _project_id, NULL,
    jsonb_build_object('forced', _force, 'material_status', p.material_status));
  PERFORM public.log_activity(format('Projeto %s pronto para OS.', p.project_number));
  PERFORM public.notify_user(uid, p.company_id, 'Projeto pronto para OS',
    format('Projeto %s está pronto para gerar Ordem de Serviço.', p.project_number));
  IF p.responsible_user_id IS NOT NULL AND p.responsible_user_id <> uid THEN
    PERFORM public.notify_user(p.responsible_user_id, p.company_id, 'Você é responsável por um projeto',
      format('Projeto %s foi marcado como pronto para OS.', p.project_number));
  END IF;
END $$;
