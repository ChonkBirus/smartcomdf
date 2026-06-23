
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.project_number_counters (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  current_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_number_counters TO authenticated;
GRANT ALL ON public.project_number_counters TO service_role;
ALTER TABLE public.project_number_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "counters_select_own_company" ON public.project_number_counters;
CREATE POLICY "counters_select_own_company" ON public.project_number_counters
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_address_id UUID REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  customer_contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  project_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'READY_TO_SCHEDULE'
    CHECK (status IN ('DRAFT','READY_TO_SCHEDULE','SCHEDULED','IN_PROGRESS','PAUSED','COMPLETED','CANCELLED')),
  priority TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  down_payment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_start_date DATE,
  expected_end_date DATE,
  completion_estimate TEXT,
  notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, project_number),
  UNIQUE(quote_id)
);
CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_select_own_company" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own_company" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own_company" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own_company" ON public.projects;
CREATE POLICY "projects_select_own_company" ON public.projects FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "projects_insert_own_company" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "projects_update_own_company" ON public.projects FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "projects_delete_own_company" ON public.projects FOR DELETE TO authenticated
  USING (company_id = public.current_company_id());
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES public.quote_items(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'PRODUCT',
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'UN',
  reserved_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  used_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_items_project ON public.project_items(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_items TO authenticated;
GRANT ALL ON public.project_items TO service_role;
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_items_select_own_company" ON public.project_items;
DROP POLICY IF EXISTS "project_items_insert_own_company" ON public.project_items;
DROP POLICY IF EXISTS "project_items_update_own_company" ON public.project_items;
DROP POLICY IF EXISTS "project_items_delete_own_company" ON public.project_items;
CREATE POLICY "project_items_select_own_company" ON public.project_items FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "project_items_insert_own_company" ON public.project_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "project_items_update_own_company" ON public.project_items FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "project_items_delete_own_company" ON public.project_items FOR DELETE TO authenticated
  USING (company_id = public.current_company_id());
DROP TRIGGER IF EXISTS trg_project_items_updated_at ON public.project_items;
CREATE TRIGGER trg_project_items_updated_at BEFORE UPDATE ON public.project_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.next_project_number(_company_id UUID)
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
  INSERT INTO public.project_number_counters(company_id, current_number)
    VALUES (_company_id, 1)
    ON CONFLICT (company_id) DO UPDATE
      SET current_number = public.project_number_counters.current_number + 1,
          updated_at = now()
    RETURNING current_number INTO seq;
  RETURN 'PRJ-' || lpad(seq::TEXT, 6, '0');
END $$;
REVOKE ALL ON FUNCTION public.next_project_number(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_project_number(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.next_project_number(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_quote_to_project(_quote_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT * INTO q FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.'; END IF;
  IF q.company_id <> cid THEN RAISE EXCEPTION 'Orçamento de outra empresa.'; END IF;
  IF q.status = 'CONVERTED' OR EXISTS (SELECT 1 FROM public.projects WHERE quote_id = q.id) THEN
    RAISE EXCEPTION 'Este orçamento já foi convertido em projeto.';
  END IF;
  IF q.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Somente orçamentos aprovados podem ser convertidos em projeto.';
  END IF;
  IF q.payment_status <> 'PAYMENT_APPROVED' THEN
    RAISE EXCEPTION 'Este orçamento foi aprovado, mas ainda está aguardando pagamento da entrada.';
  END IF;

  SELECT id INTO addr_id FROM public.customer_addresses
    WHERE customer_id = q.customer_id ORDER BY is_primary DESC, created_at ASC LIMIT 1;
  SELECT id INTO cont_id FROM public.customer_contacts
    WHERE customer_id = q.customer_id ORDER BY is_primary DESC, created_at ASC LIMIT 1;

  pnum := public.next_project_number(cid);

  INSERT INTO public.projects(
    company_id, quote_id, customer_id, customer_address_id, customer_contact_id,
    project_number, title, description, status, priority,
    total_amount, down_payment_amount, remaining_amount,
    completion_estimate, notes, created_by
  ) VALUES (
    cid, q.id, q.customer_id, addr_id, cont_id,
    pnum, COALESCE(NULLIF(q.title,''), 'Projeto ' || q.quote_number),
    q.customer_notes, 'READY_TO_SCHEDULE', 'NORMAL',
    COALESCE(q.total_amount,0), COALESCE(q.down_payment_amount,0), COALESCE(q.remaining_amount,0),
    q.completion_estimate, q.customer_notes, uid
  ) RETURNING id INTO pid;

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

  UPDATE public.quotes SET status = 'CONVERTED', converted_at = now() WHERE id = q.id;

  PERFORM public.log_audit('projects','create', pid, NULL,
    jsonb_build_object('quote_id', q.id, 'project_number', pnum));
  PERFORM public.log_activity(format('Orçamento %s convertido em projeto %s.', q.quote_number, pnum));
  PERFORM public.notify_user(uid, cid, 'Projeto criado',
    format('Projeto %s criado a partir do orçamento %s.', pnum, q.quote_number));

  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.convert_quote_to_project(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_quote_to_project(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_project(UUID) TO authenticated;

INSERT INTO public.permissions(slug, module, action, description)
SELECT s, 'projects', a, l FROM (VALUES
  ('projects.view','view','Visualizar projetos'),
  ('projects.create','create','Criar projetos'),
  ('projects.edit','edit','Editar projetos'),
  ('projects.cancel','cancel','Cancelar projetos'),
  ('projects.convert_from_quote','convert','Converter orçamento em projeto')
) AS v(s,a,l)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'owner' AND p.slug LIKE 'projects.%'
ON CONFLICT DO NOTHING;
