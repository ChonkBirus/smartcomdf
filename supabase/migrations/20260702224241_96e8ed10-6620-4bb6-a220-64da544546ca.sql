
-- 1) Colunas opportunity_id
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_opportunity_id ON public.projects(opportunity_id);

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_opportunity_id ON public.service_orders(opportunity_id);

-- 2) Backfill
UPDATE public.projects p
   SET opportunity_id = q.opportunity_id
  FROM public.quotes q
 WHERE p.quote_id = q.id
   AND q.opportunity_id IS NOT NULL
   AND p.opportunity_id IS NULL;

UPDATE public.projects p
   SET opportunity_id = o.id
  FROM public.crm_opportunities o
 WHERE o.project_id = p.id
   AND p.opportunity_id IS NULL;

UPDATE public.service_orders so
   SET opportunity_id = p.opportunity_id
  FROM public.projects p
 WHERE so.project_id = p.id
   AND p.opportunity_id IS NOT NULL
   AND so.opportunity_id IS NULL;

UPDATE public.service_orders so
   SET opportunity_id = o.id
  FROM public.crm_opportunities o
 WHERE o.service_order_id = so.id
   AND so.opportunity_id IS NULL;

-- 3) Dedupe gatilho de orçamentos
DROP TRIGGER IF EXISTS trg_crm_sync_quote_status ON public.quotes;
CREATE TRIGGER trg_crm_sync_quote_status
AFTER INSERT OR UPDATE OF status ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_quote_status();

-- 4) Trigger sincroniza projetos ↔ CRM
CREATE OR REPLACE FUNCTION public.crm_sync_project_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp RECORD;
  v_won_stage UUID;
  v_title TEXT;
  v_event TEXT;
BEGIN
  -- Copia opportunity_id do orçamento se ausente
  IF NEW.opportunity_id IS NULL AND NEW.quote_id IS NOT NULL THEN
    SELECT opportunity_id INTO NEW.opportunity_id
      FROM public.quotes WHERE id = NEW.quote_id;
  END IF;

  IF NEW.opportunity_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, company_id, pipeline_id, project_id, won_at
    INTO v_opp
    FROM public.crm_opportunities
   WHERE id = NEW.opportunity_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Espelha project_id na oportunidade
  IF v_opp.project_id IS DISTINCT FROM NEW.id THEN
    UPDATE public.crm_opportunities
       SET project_id = NEW.id, updated_at = now()
     WHERE id = v_opp.id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event := 'project_created';
    v_title := 'Projeto criado: ' || COALESCE(NEW.project_number, '—');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := CASE WHEN NEW.status = 'COMPLETED' THEN 'project_completed' ELSE 'project_status_changed' END;
    v_title := 'Projeto ' || COALESCE(NEW.project_number, '—') || ': ' || COALESCE(NEW.status, '?');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.crm_timeline(company_id, opportunity_id, event_type, title, metadata, created_by)
  VALUES (v_opp.company_id, v_opp.id, v_event, v_title,
          jsonb_build_object('project_id', NEW.id, 'status', NEW.status, 'project_number', NEW.project_number),
          NEW.responsible_user_id);

  -- Garante estágio "won" se ainda não marcada
  IF NEW.status = 'COMPLETED' AND v_opp.won_at IS NULL THEN
    SELECT id INTO v_won_stage FROM public.crm_stages
      WHERE pipeline_id = v_opp.pipeline_id AND is_won = TRUE
      ORDER BY position LIMIT 1;
    UPDATE public.crm_opportunities
       SET won_at = now(),
           stage_id = COALESCE(v_won_stage, stage_id),
           updated_at = now()
     WHERE id = v_opp.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_sync_project_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_crm_sync_project_status ON public.projects;
CREATE TRIGGER trg_crm_sync_project_status
BEFORE INSERT OR UPDATE OF status, quote_id, opportunity_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_project_status();

-- 5) Trigger sincroniza service_orders ↔ CRM
CREATE OR REPLACE FUNCTION public.crm_sync_service_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp RECORD;
  v_title TEXT;
  v_event TEXT;
  v_so_number TEXT;
BEGIN
  IF NEW.opportunity_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT opportunity_id INTO NEW.opportunity_id
      FROM public.projects WHERE id = NEW.project_id;
  END IF;

  IF NEW.opportunity_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, company_id, service_order_id
    INTO v_opp
    FROM public.crm_opportunities
   WHERE id = NEW.opportunity_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_opp.service_order_id IS DISTINCT FROM NEW.id THEN
    UPDATE public.crm_opportunities
       SET service_order_id = NEW.id, updated_at = now()
     WHERE id = v_opp.id;
  END IF;

  v_so_number := COALESCE(NEW.os_number, NEW.service_order_number, '—');

  IF TG_OP = 'INSERT' THEN
    v_event := 'service_order_created';
    v_title := 'OS criada: ' || v_so_number;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := CASE WHEN NEW.status IN ('COMPLETED','CLOSED','FINISHED') THEN 'service_order_completed' ELSE 'service_order_status_changed' END;
    v_title := 'OS ' || v_so_number || ': ' || COALESCE(NEW.status, '?');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.crm_timeline(company_id, opportunity_id, event_type, title, metadata, created_by)
  VALUES (v_opp.company_id, v_opp.id, v_event, v_title,
          jsonb_build_object('service_order_id', NEW.id, 'status', NEW.status, 'os_number', v_so_number),
          NEW.created_by);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_sync_service_order_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_crm_sync_service_order_status ON public.service_orders;
CREATE TRIGGER trg_crm_sync_service_order_status
BEFORE INSERT OR UPDATE OF status, project_id, opportunity_id ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_service_order_status();
