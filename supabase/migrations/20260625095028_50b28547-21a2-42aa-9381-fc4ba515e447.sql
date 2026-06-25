
CREATE TABLE public.cnpj_lookup_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  normalized_data JSONB NOT NULL,
  raw_payload JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cnpj_lookup_cache TO authenticated;
GRANT ALL ON public.cnpj_lookup_cache TO service_role;
ALTER TABLE public.cnpj_lookup_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cache" ON public.cnpj_lookup_cache FOR SELECT TO authenticated USING (true);

CREATE TABLE public.cnpj_lookup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  cnpj TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS','NOT_FOUND','INVALID_CNPJ','PROVIDER_ERROR','RATE_LIMITED')),
  result_summary JSONB,
  error_message TEXT,
  requested_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cnpj_lookup_logs_company_created_idx ON public.cnpj_lookup_logs (company_id, created_at DESC);
CREATE INDEX cnpj_lookup_logs_user_created_idx ON public.cnpj_lookup_logs (requested_by, created_at DESC);
GRANT SELECT ON public.cnpj_lookup_logs TO authenticated;
GRANT ALL ON public.cnpj_lookup_logs TO service_role;
ALTER TABLE public.cnpj_lookup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read own company logs" ON public.cnpj_lookup_logs FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
