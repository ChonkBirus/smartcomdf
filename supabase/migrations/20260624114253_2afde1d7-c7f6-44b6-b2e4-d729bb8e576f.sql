
-- Counters
CREATE TABLE public.service_order_number_counters (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  current_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_order_number_counters TO authenticated;
GRANT ALL ON public.service_order_number_counters TO service_role;
ALTER TABLE public.service_order_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so_counters_select_own_company" ON public.service_order_number_counters
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());

-- Service Orders
CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_address_id UUID REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  customer_contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  service_order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  customer_instructions TEXT,
  access_instructions TEXT,
  parking_instructions TEXT,
  technical_notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT so_status_chk CHECK (status IN ('DRAFT','SCHEDULED','IN_PROGRESS','PAUSED','COMPLETED','CANCELLED')),
  CONSTRAINT so_priority_chk CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  CONSTRAINT so_number_unique_per_company UNIQUE (company_id, service_order_number)
);
CREATE INDEX idx_so_company ON public.service_orders(company_id);
CREATE INDEX idx_so_project ON public.service_orders(project_id);
CREATE INDEX idx_so_customer ON public.service_orders(customer_id);
CREATE INDEX idx_so_status ON public.service_orders(status);
CREATE INDEX idx_so_scheduled_date ON public.service_orders(scheduled_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "so_select_own_company" ON public.service_orders
  FOR SELECT TO authenticated
  USING ((company_id = public.current_company_id() AND public.has_permission('service_orders.view')) OR public.is_super_admin() OR public.has_company_role('owner'));
CREATE POLICY "so_insert_own_company" ON public.service_orders
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (public.has_permission('service_orders.create') OR public.has_company_role('owner') OR public.is_super_admin()));
CREATE POLICY "so_update_own_company" ON public.service_orders
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (public.has_permission('service_orders.edit') OR public.has_permission('service_orders.cancel') OR public.has_company_role('owner') OR public.is_super_admin()))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "so_delete_owner_only" ON public.service_orders
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE TRIGGER trg_so_updated_at BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Service Order Items
CREATE TABLE public.service_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  project_item_id UUID REFERENCES public.project_items(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'PRODUCT',
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  planned_quantity NUMERIC NOT NULL DEFAULT 0,
  used_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'UN',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_soi_so ON public.service_order_items(service_order_id);
CREATE INDEX idx_soi_company ON public.service_order_items(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_items TO authenticated;
GRANT ALL ON public.service_order_items TO service_role;
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soi_select_own_company" ON public.service_order_items
  FOR SELECT TO authenticated
  USING ((company_id = public.current_company_id() AND public.has_permission('service_orders.view')) OR public.is_super_admin() OR public.has_company_role('owner'));
CREATE POLICY "soi_insert_own_company" ON public.service_order_items
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (public.has_permission('service_orders.create') OR public.has_permission('service_orders.edit') OR public.has_company_role('owner') OR public.is_super_admin()));
CREATE POLICY "soi_update_own_company" ON public.service_order_items
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (public.has_permission('service_orders.edit') OR public.has_company_role('owner') OR public.is_super_admin()))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "soi_delete_owner_only" ON public.service_order_items
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_company_role('owner'));

CREATE TRIGGER trg_soi_updated_at BEFORE UPDATE ON public.service_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permissions
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('service_orders.view', 'service_orders', 'view', 'Visualizar Ordens de Serviço'),
  ('service_orders.create', 'service_orders', 'create', 'Criar Ordens de Serviço'),
  ('service_orders.edit', 'service_orders', 'edit', 'Editar Ordens de Serviço'),
  ('service_orders.cancel', 'service_orders', 'cancel', 'Cancelar Ordens de Serviço'),
  ('service_orders.assign_technician', 'service_orders', 'assign', 'Atribuir técnico à Ordem de Serviço')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug IN ('owner','admin','manager','operations_manager')
  AND p.slug IN ('service_orders.view','service_orders.create','service_orders.edit','service_orders.cancel','service_orders.assign_technician')
ON CONFLICT DO NOTHING;

-- Numbering function
CREATE OR REPLACE FUNCTION public.next_service_order_number(_company_id UUID)
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
  ) THEN
    RAISE EXCEPTION 'Usuário não autorizado para esta empresa.';
  END IF;
  INSERT INTO public.service_order_number_counters(company_id, current_number)
    VALUES (_company_id, 1)
    ON CONFLICT (company_id) DO UPDATE
      SET current_number = public.service_order_number_counters.current_number + 1,
          updated_at = now()
    RETURNING current_number INTO seq;
  RETURN 'OS-' || lpad(seq::TEXT, 6, '0');
END $$;

REVOKE ALL ON FUNCTION public.next_service_order_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_service_order_number(UUID) TO authenticated, service_role;

-- Create OS from Project
CREATE OR REPLACE FUNCTION public.create_service_order_from_project(_project_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
  p RECORD;
  so_id UUID;
  so_num TEXT;
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
END $$;

REVOKE ALL ON FUNCTION public.create_service_order_from_project(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_service_order_from_project(UUID) TO authenticated, service_role;

-- Cancel OS
CREATE OR REPLACE FUNCTION public.cancel_service_order(_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid UUID := auth.uid(); cid UUID; so RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF NOT (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('service_orders.cancel')) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar OS.';
  END IF;
  SELECT * INTO so FROM public.service_orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  IF so.company_id <> cid AND NOT public.is_super_admin() THEN RAISE EXCEPTION 'Outra empresa.'; END IF;
  IF so.status = 'CANCELLED' THEN RAISE EXCEPTION 'OS já cancelada.'; END IF;
  IF so.status = 'COMPLETED' THEN RAISE EXCEPTION 'OS concluída não pode ser cancelada.'; END IF;

  UPDATE public.service_orders SET
    status = 'CANCELLED',
    cancelled_at = now(),
    internal_notes = COALESCE(internal_notes || E'\n', '') || COALESCE('[CANCELAMENTO] ' || _reason, '[CANCELAMENTO]'),
    updated_at = now()
  WHERE id = _id;

  PERFORM public.log_audit('service_orders','cancel', _id, NULL, jsonb_build_object('reason', _reason));
  PERFORM public.log_activity(format('OS %s cancelada.', so.service_order_number));
  PERFORM public.notify_user(uid, so.company_id, 'OS cancelada',
    format('Ordem de Serviço %s cancelada.', so.service_order_number));
END $$;

REVOKE ALL ON FUNCTION public.cancel_service_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_service_order(UUID, TEXT) TO authenticated, service_role;
