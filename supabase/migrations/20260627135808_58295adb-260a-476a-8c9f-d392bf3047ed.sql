
ALTER TABLE public.commercial_pilots
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'NOT_STARTED';

CREATE OR REPLACE FUNCTION public.get_pilot_activation(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customers int := 0; v_items int := 0; v_quotes int := 0;
  v_pdfs int := 0; v_sent int := 0; v_approved int := 0;
  v_projects int := 0; v_os int := 0; v_os_done int := 0;
  v_reports int := 0; v_users int := 0;
  v_last_login timestamptz; v_recent_login boolean := false;
  v_score int := 0;
BEGIN
  SELECT count(*) INTO v_customers FROM public.customers WHERE company_id = _company_id;
  SELECT count(*) INTO v_items FROM public.items WHERE company_id = _company_id;
  SELECT count(*) INTO v_quotes FROM public.quotes WHERE company_id = _company_id;
  SELECT count(DISTINCT quote_id) INTO v_pdfs FROM public.quote_history
    WHERE company_id = _company_id AND event_type IN ('pdf_downloaded','pdf_generated');
  SELECT count(*) INTO v_sent FROM public.quotes
    WHERE company_id = _company_id AND first_sent_at IS NOT NULL;
  SELECT count(*) INTO v_approved FROM public.quotes
    WHERE company_id = _company_id AND status = 'APPROVED';
  SELECT count(*) INTO v_projects FROM public.projects WHERE company_id = _company_id;
  SELECT count(*) INTO v_os FROM public.service_orders WHERE company_id = _company_id;
  SELECT count(*) INTO v_os_done FROM public.service_orders
    WHERE company_id = _company_id AND status = 'COMPLETED';
  SELECT count(*) INTO v_reports FROM public.service_order_reports r
    JOIN public.service_orders so ON so.id = r.service_order_id
    WHERE so.company_id = _company_id;
  SELECT count(DISTINCT pr.profile_id), max(au.last_sign_in_at)
    INTO v_users, v_last_login
    FROM public.profile_roles pr
    JOIN auth.users au ON au.id = pr.profile_id
    WHERE pr.company_id = _company_id;
  v_recent_login := (v_last_login IS NOT NULL AND v_last_login > (now() - interval '14 days'));

  IF v_customers > 0 THEN v_score := v_score + 10; END IF;
  IF v_items > 0 THEN v_score := v_score + 10; END IF;
  IF v_quotes > 0 THEN v_score := v_score + 20; END IF;
  IF v_pdfs > 0 THEN v_score := v_score + 15; END IF;
  IF v_sent > 0 THEN v_score := v_score + 10; END IF;
  IF v_os > 0 THEN v_score := v_score + 15; END IF;
  IF v_reports > 0 THEN v_score := v_score + 10; END IF;
  IF v_recent_login THEN v_score := v_score + 10; END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'tier', CASE WHEN v_score<=30 THEN 'LOW' WHEN v_score<=60 THEN 'ACTIVATING'
                 WHEN v_score<=80 THEN 'GOOD' ELSE 'READY' END,
    'last_login', v_last_login,
    'users_count', v_users,
    'checklist', jsonb_build_object(
      'first_customer', v_customers > 0,
      'first_item', v_items > 0,
      'first_quote', v_quotes > 0,
      'first_pdf', v_pdfs > 0,
      'first_sent', v_sent > 0,
      'first_approved', v_approved > 0,
      'first_project', v_projects > 0,
      'first_os', v_os > 0,
      'first_os_done', v_os_done > 0,
      'first_report', v_reports > 0
    ),
    'counts', jsonb_build_object(
      'customers', v_customers, 'items', v_items, 'quotes', v_quotes,
      'pdfs', v_pdfs, 'sent', v_sent, 'approved', v_approved,
      'projects', v_projects, 'service_orders', v_os,
      'service_orders_done', v_os_done, 'reports', v_reports, 'users', v_users
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pilot_activation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pilot_activation(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.pilot_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pilot_id uuid REFERENCES public.commercial_pilots(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('BUG','IMPROVEMENT','QUESTION','PRAISE','BLOCKER')),
  module text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','PLANNED','RESOLVED','REJECTED')),
  screen text,
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  assignee text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_feedback TO authenticated;
GRANT ALL ON public.pilot_feedback TO service_role;

ALTER TABLE public.pilot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage pilot feedback"
  ON public.pilot_feedback FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_pilot_feedback_updated_at
  BEFORE UPDATE ON public.pilot_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_company ON public.pilot_feedback(company_id);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_status ON public.pilot_feedback(status);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_priority ON public.pilot_feedback(priority);
