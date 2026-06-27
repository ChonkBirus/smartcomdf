
CREATE TABLE public.production_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  note TEXT,
  responsible TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_pchk_company ON public.production_checklist_items(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_checklist_items TO authenticated;
GRANT ALL ON public.production_checklist_items TO service_role;

ALTER TABLE public.production_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pchk_select" ON public.production_checklist_items FOR SELECT TO authenticated
  USING (public.is_company_member(company_id) AND public.has_permission('settings.manage'));

CREATE POLICY "pchk_insert" ON public.production_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id) AND public.has_permission('settings.manage'));

CREATE POLICY "pchk_update" ON public.production_checklist_items FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id) AND public.has_permission('settings.manage'))
  WITH CHECK (public.is_company_member(company_id) AND public.has_permission('settings.manage'));

CREATE POLICY "pchk_delete" ON public.production_checklist_items FOR DELETE TO authenticated
  USING (public.is_company_member(company_id) AND public.has_permission('settings.manage'));

CREATE TRIGGER trg_pchk_updated_at
  BEFORE UPDATE ON public.production_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
