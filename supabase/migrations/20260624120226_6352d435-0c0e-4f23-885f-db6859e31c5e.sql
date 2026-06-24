
-- =========================================================================
-- FASE 2.6B - ETAPA A: DB + RLS + STORAGE + RBAC
-- Execução da OS pelo técnico (sem UI ainda)
-- =========================================================================

-- ---- 1) ALTER service_orders -------------------------------------------
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS execution_started_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_notes        TEXT,
  ADD COLUMN IF NOT EXISTS technician_report      TEXT,
  ADD COLUMN IF NOT EXISTS customer_absent        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issue_found            TEXT,
  ADD COLUMN IF NOT EXISTS solution_applied       TEXT,
  ADD COLUMN IF NOT EXISTS pending_reason         TEXT;

-- ---- 2) Tabelas de execução -------------------------------------------

-- Templates de checklist
CREATE TABLE IF NOT EXISTS public.service_order_checklist_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  service_type TEXT,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_so_chk_tpl_company ON public.service_order_checklist_templates(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_checklist_templates TO authenticated;
GRANT ALL ON public.service_order_checklist_templates TO service_role;
ALTER TABLE public.service_order_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_so_chk_tpl_updated_at BEFORE UPDATE ON public.service_order_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY so_chk_tpl_select ON public.service_order_checklist_templates
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY so_chk_tpl_modify ON public.service_order_checklist_templates
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id()
         AND (public.has_permission('service_orders.manage_checklist')
              OR public.has_company_role('owner')
              OR public.is_super_admin()))
  WITH CHECK (company_id = public.current_company_id());

-- Itens dos templates
CREATE TABLE IF NOT EXISTS public.service_order_checklist_template_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.service_order_checklist_templates(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  required    BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_so_chk_tpl_items_tpl ON public.service_order_checklist_template_items(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_checklist_template_items TO authenticated;
GRANT ALL ON public.service_order_checklist_template_items TO service_role;
ALTER TABLE public.service_order_checklist_template_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_so_chk_tpl_items_updated_at BEFORE UPDATE ON public.service_order_checklist_template_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY so_chk_tpl_items_select ON public.service_order_checklist_template_items
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY so_chk_tpl_items_modify ON public.service_order_checklist_template_items
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id()
         AND (public.has_permission('service_orders.manage_checklist')
              OR public.has_company_role('owner')
              OR public.is_super_admin()))
  WITH CHECK (company_id = public.current_company_id());

-- Itens de checklist da OS
CREATE TABLE IF NOT EXISTS public.service_order_checklist_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  required         BOOLEAN NOT NULL DEFAULT false,
  checked          BOOLEAN NOT NULL DEFAULT false,
  checked_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  checked_at       TIMESTAMPTZ,
  notes            TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_so_chk_items_so ON public.service_order_checklist_items(service_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_checklist_items TO authenticated;
GRANT ALL ON public.service_order_checklist_items TO service_role;
ALTER TABLE public.service_order_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_so_chk_items_updated_at BEFORE UPDATE ON public.service_order_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fotos da OS
CREATE TABLE IF NOT EXISTS public.service_order_photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  photo_type       TEXT NOT NULL CHECK (photo_type IN ('BEFORE','DURING','AFTER','PROBLEM','MATERIAL','OTHER')),
  file_url         TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  file_size        INTEGER,
  description      TEXT,
  uploaded_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_so_photos_so ON public.service_order_photos(service_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_photos TO authenticated;
GRANT ALL ON public.service_order_photos TO service_role;
ALTER TABLE public.service_order_photos ENABLE ROW LEVEL SECURITY;

-- Materiais utilizados
CREATE TABLE IF NOT EXISTS public.service_order_material_usage (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id       UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  item_id                UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  service_order_item_id  UUID REFERENCES public.service_order_items(id) ON DELETE SET NULL,
  stock_location_id      UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  planned_quantity       NUMERIC NOT NULL DEFAULT 0,
  used_quantity          NUMERIC NOT NULL DEFAULT 0,
  unit                   TEXT,
  notes                  TEXT,
  created_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_so_mat_usage_so ON public.service_order_material_usage(service_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_material_usage TO authenticated;
GRANT ALL ON public.service_order_material_usage TO service_role;
ALTER TABLE public.service_order_material_usage ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_so_mat_usage_updated_at BEFORE UPDATE ON public.service_order_material_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Logs de execução
CREATE TABLE IF NOT EXISTS public.service_order_execution_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action           TEXT NOT NULL CHECK (action IN (
                     'STARTED','PAUSED','RESUMED','CHECKLIST_UPDATED','PHOTO_ADDED',
                     'MATERIAL_ADDED','MATERIAL_UPDATED','NOTE_ADDED','FINISHED_EXECUTION')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_so_exec_logs_so ON public.service_order_execution_logs(service_order_id, created_at DESC);
GRANT SELECT, INSERT ON public.service_order_execution_logs TO authenticated;
GRANT ALL ON public.service_order_execution_logs TO service_role;
ALTER TABLE public.service_order_execution_logs ENABLE ROW LEVEL SECURITY;

-- ---- 3) Helper: pode acessar a OS? ------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_service_order(_so_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_orders so
    WHERE so.id = _so_id
      AND (public.is_super_admin()
           OR (so.company_id = public.current_company_id()
               AND (public.has_company_role('owner')
                    OR public.has_permission('service_orders.edit')
                    OR public.has_permission('service_orders.assign_technician')
                    OR so.assigned_technician_id = auth.uid()
                    OR so.responsible_user_id = auth.uid())))
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_access_service_order(UUID) TO authenticated;

-- ---- 4) Políticas das tabelas de execução -----------------------------

CREATE POLICY so_chk_items_select ON public.service_order_checklist_items
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY so_chk_items_modify ON public.service_order_checklist_items
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id()
         AND public.can_access_service_order(service_order_id)
         AND (public.has_permission('service_orders.manage_checklist')
              OR public.has_permission('service_orders.execute')
              OR public.has_company_role('owner')
              OR public.is_super_admin()))
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY so_photos_select ON public.service_order_photos
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY so_photos_insert ON public.service_order_photos
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id()
              AND public.can_access_service_order(service_order_id)
              AND (public.has_permission('service_orders.upload_photos')
                   OR public.has_permission('service_orders.execute')
                   OR public.has_company_role('owner')
                   OR public.is_super_admin()));
CREATE POLICY so_photos_delete ON public.service_order_photos
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id()
         AND (uploaded_by = auth.uid()
              OR public.has_company_role('owner')
              OR public.is_super_admin()));

CREATE POLICY so_mat_usage_select ON public.service_order_material_usage
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY so_mat_usage_modify ON public.service_order_material_usage
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id()
         AND public.can_access_service_order(service_order_id)
         AND (public.has_permission('service_orders.manage_material_usage')
              OR public.has_permission('service_orders.execute')
              OR public.has_company_role('owner')
              OR public.is_super_admin()))
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY so_exec_logs_select ON public.service_order_execution_logs
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));
CREATE POLICY so_exec_logs_insert ON public.service_order_execution_logs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id()
              AND public.can_access_service_order(service_order_id));

-- ---- 5) Restringir SELECT em service_orders para técnico --------------
DROP POLICY IF EXISTS so_select_own_company ON public.service_orders;
CREATE POLICY so_select_own_company ON public.service_orders
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.current_company_id()
        AND public.has_permission('service_orders.view')
        AND (public.has_company_role('owner')
             OR public.has_permission('service_orders.edit')
             OR public.has_permission('service_orders.assign_technician')
             OR assigned_technician_id = auth.uid()
             OR responsible_user_id = auth.uid()))
  );

-- service_order_items: restringir leitura ao acesso da OS
DROP POLICY IF EXISTS soi_select_own_company ON public.service_order_items;
CREATE POLICY soi_select_own_company ON public.service_order_items
  FOR SELECT TO authenticated
  USING (public.can_access_service_order(service_order_id));

-- ---- 6) Permissões novas ---------------------------------------------
INSERT INTO public.permissions (slug, module, action) VALUES
  ('service_orders.execute',              'service_orders', 'execute'),
  ('service_orders.start',                'service_orders', 'start'),
  ('service_orders.pause',                'service_orders', 'pause'),
  ('service_orders.finish_execution',     'service_orders', 'finish_execution'),
  ('service_orders.manage_checklist',     'service_orders', 'manage_checklist'),
  ('service_orders.upload_photos',        'service_orders', 'upload_photos'),
  ('service_orders.manage_material_usage','service_orders', 'manage_material_usage'),
  ('service_orders.view_assigned_only',   'service_orders', 'view_assigned_only')
ON CONFLICT (slug) DO NOTHING;

-- Conceder ao Técnico: view, execute, start, pause, finish, checklist, photos, materials, view_assigned_only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.slug = ANY(ARRAY[
  'service_orders.view',
  'service_orders.execute',
  'service_orders.start',
  'service_orders.pause',
  'service_orders.finish_execution',
  'service_orders.manage_checklist',
  'service_orders.upload_photos',
  'service_orders.manage_material_usage',
  'service_orders.view_assigned_only'
])
WHERE r.slug = 'technician'
ON CONFLICT DO NOTHING;

-- Conceder ao Gerente: tudo de execução também
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.module = 'service_orders'
WHERE r.slug = 'manager'
ON CONFLICT DO NOTHING;

-- ---- 7) Storage RLS: bucket service-order-photos ----------------------
-- Padrão de caminho: {company_id}/{service_order_id}/{file_name}
CREATE POLICY so_photos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'service-order-photos'
         AND (
           public.is_super_admin()
           OR (split_part(name, '/', 1))::uuid = public.current_company_id()
         ));

CREATE POLICY so_photos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-order-photos'
              AND (split_part(name, '/', 1))::uuid = public.current_company_id()
              AND (public.has_permission('service_orders.upload_photos')
                   OR public.has_permission('service_orders.execute')
                   OR public.has_company_role('owner')
                   OR public.is_super_admin()));

CREATE POLICY so_photos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'service-order-photos'
         AND (split_part(name, '/', 1))::uuid = public.current_company_id()
         AND (owner = auth.uid()
              OR public.has_company_role('owner')
              OR public.is_super_admin()));

-- ---- 8) Atualizar create_service_order_from_project: copiar checklist do template padrão
CREATE OR REPLACE FUNCTION public.create_service_order_from_project(_project_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  p RECORD;
  so_id UUID;
  so_num TEXT;
  tpl_id UUID;
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
  IF p.responsible_user_id IS NULL THEN RAISE EXCEPTION 'Projeto sem responsável.'; END IF;
  IF p.planned_start_date IS NULL THEN RAISE EXCEPTION 'Projeto sem data prevista.'; END IF;

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
    p.responsible_user_id, p.responsible_user_id,
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

  -- Copiar itens do template padrão (mais recente ativo da empresa)
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

  UPDATE public.projects SET
    status = CASE WHEN status = 'READY_TO_SCHEDULE' THEN 'SCHEDULED' ELSE status END,
    updated_at = now()
  WHERE id = _project_id;

  PERFORM public.log_audit('service_orders','create', so_id, NULL,
    jsonb_build_object('project_id', _project_id, 'service_order_number', so_num));
  PERFORM public.log_activity(format('OS %s criada a partir do projeto %s.', so_num, p.project_number));
  PERFORM public.notify_user(uid, p.company_id, 'Ordem de Serviço criada',
    format('OS %s criada a partir do projeto %s.', so_num, p.project_number));
  IF p.responsible_user_id IS NOT NULL AND p.responsible_user_id <> uid THEN
    PERFORM public.notify_user(p.responsible_user_id, p.company_id, 'Você é técnico de uma OS',
      format('OS %s foi agendada para você.', so_num));
  END IF;

  RETURN so_id;
END $function$;
