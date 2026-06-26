CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tour_key text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','SKIPPED')),
  current_step integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, tour_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_onboarding_progress TO authenticated;
GRANT ALL ON public.user_onboarding_progress TO service_role;

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uop_select_own" ON public.user_onboarding_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_company_member(company_id));

CREATE POLICY "uop_insert_own" ON public.user_onboarding_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_company_member(company_id));

CREATE POLICY "uop_update_own" ON public.user_onboarding_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_company_member(company_id))
  WITH CHECK (user_id = auth.uid() AND public.is_company_member(company_id));

CREATE POLICY "uop_delete_own" ON public.user_onboarding_progress
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_company_member(company_id));

CREATE TRIGGER set_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_uop_user_company ON public.user_onboarding_progress(user_id, company_id);
