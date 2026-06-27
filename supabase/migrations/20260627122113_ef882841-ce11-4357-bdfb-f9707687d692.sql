
CREATE TABLE public.qa_bugs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screen TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT,
  root_cause TEXT,
  fix TEXT,
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','fixed','wont_fix','closed')),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_bugs_status ON public.qa_bugs(status);
CREATE INDEX idx_qa_bugs_priority ON public.qa_bugs(priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_bugs TO authenticated;
GRANT ALL ON public.qa_bugs TO service_role;

ALTER TABLE public.qa_bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_bugs_super_admin_all" ON public.qa_bugs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_qa_bugs_updated_at
  BEFORE UPDATE ON public.qa_bugs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
