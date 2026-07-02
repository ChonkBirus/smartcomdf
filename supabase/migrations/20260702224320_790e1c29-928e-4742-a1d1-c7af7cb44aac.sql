
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

  v_so_number := COALESCE(NEW.service_order_number, '—');

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
          jsonb_build_object('service_order_id', NEW.id, 'status', NEW.status, 'service_order_number', v_so_number),
          NEW.created_by);

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_sync_service_order_status() FROM PUBLIC, anon, authenticated;
