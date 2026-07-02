
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotes_opportunity_id_idx ON public.quotes(opportunity_id);

-- Backfill from existing crm_opportunities.quote_id
UPDATE public.quotes q
SET opportunity_id = o.id
FROM public.crm_opportunities o
WHERE o.quote_id = q.id AND q.opportunity_id IS NULL;

CREATE OR REPLACE FUNCTION public.crm_sync_quote_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp RECORD;
  v_won_stage UUID;
  v_lost_stage UUID;
  v_event_title TEXT;
BEGIN
  IF NEW.opportunity_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT id, company_id, pipeline_id, stage_id, won_at, lost_at
    INTO v_opp
    FROM public.crm_opportunities
   WHERE id = NEW.opportunity_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_event_title := 'Status do orçamento: ' || COALESCE(NEW.status, '?');

  INSERT INTO public.crm_timeline(company_id, opportunity_id, event_type, title, metadata, created_by)
  VALUES (v_opp.company_id, v_opp.id, 'quote_status_changed', v_event_title,
          jsonb_build_object('quote_id', NEW.id, 'status', NEW.status), NEW.created_by);

  IF NEW.status = 'APPROVED' AND v_opp.won_at IS NULL THEN
    SELECT id INTO v_won_stage FROM public.crm_stages
      WHERE pipeline_id = v_opp.pipeline_id AND is_won = TRUE
      ORDER BY position LIMIT 1;
    UPDATE public.crm_opportunities
       SET won_at = now(),
           stage_id = COALESCE(v_won_stage, stage_id),
           updated_at = now()
     WHERE id = v_opp.id;
  ELSIF NEW.status = 'REJECTED' AND v_opp.lost_at IS NULL THEN
    SELECT id INTO v_lost_stage FROM public.crm_stages
      WHERE pipeline_id = v_opp.pipeline_id AND is_lost = TRUE
      ORDER BY position LIMIT 1;
    UPDATE public.crm_opportunities
       SET lost_at = now(),
           lost_reason = COALESCE(lost_reason, 'Orçamento rejeitado pelo cliente'),
           stage_id = COALESCE(v_lost_stage, stage_id),
           updated_at = now()
     WHERE id = v_opp.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_sync_quote_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_crm_sync_quote_status ON public.quotes;
CREATE TRIGGER trg_crm_sync_quote_status
  AFTER INSERT OR UPDATE OF status ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_quote_status();
