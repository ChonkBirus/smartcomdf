
CREATE TABLE IF NOT EXISTS public.openfinance_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('PLUGGY','BELVO','MANUAL','OTHER')),
  provider_connection_id text NULL,
  provider_item_id text NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONNECTED','SYNCING','ERROR','EXPIRED','REVOKED')),
  consent_id text NULL,
  consent_expires_at timestamptz NULL,
  last_sync_at timestamptz NULL,
  error_message text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ofc_company ON public.openfinance_connections(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.openfinance_connections TO authenticated;
GRANT ALL ON public.openfinance_connections TO service_role;
ALTER TABLE public.openfinance_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ofc_select_member" ON public.openfinance_connections FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "ofc_insert_member" ON public.openfinance_connections FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "ofc_update_member" ON public.openfinance_connections FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_openfinance_connections_updated_at BEFORE UPDATE ON public.openfinance_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.financial_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'MANUAL' CHECK (provider IN ('PLUGGY','BELVO','MANUAL','OTHER')),
  openfinance_connection_id uuid NULL REFERENCES public.openfinance_connections(id) ON DELETE SET NULL,
  provider_account_id text NULL,
  bank_name text NOT NULL,
  bank_code text NULL,
  account_name text NULL,
  account_type text NULL,
  agency text NULL,
  account_number_masked text NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  consent_status text NULL,
  last_sync_at timestamptz NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_fba_company ON public.financial_bank_accounts(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_bank_accounts TO authenticated;
GRANT ALL ON public.financial_bank_accounts TO service_role;
ALTER TABLE public.financial_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fba_select_member" ON public.financial_bank_accounts FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "fba_insert_member" ON public.financial_bank_accounts FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "fba_update_member" ON public.financial_bank_accounts FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_financial_bank_accounts_updated_at BEFORE UPDATE ON public.financial_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.openfinance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id uuid NULL REFERENCES public.openfinance_connections(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('PLUGGY','BELVO','MANUAL','OTHER')),
  provider_transaction_id text NOT NULL,
  bank_account_id uuid NULL REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('CREDIT','DEBIT')),
  category_suggestion text NULL,
  raw_payload jsonb NULL,
  reconciled_transaction_id uuid NULL,
  reconciliation_status text NOT NULL DEFAULT 'PENDING' CHECK (reconciliation_status IN ('PENDING','SUGGESTED','RECONCILED','IGNORED')),
  ignore_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_oft_company_date ON public.openfinance_transactions(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_oft_status ON public.openfinance_transactions(company_id, reconciliation_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.openfinance_transactions TO authenticated;
GRANT ALL ON public.openfinance_transactions TO service_role;
ALTER TABLE public.openfinance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oft_select_member" ON public.openfinance_transactions FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "oft_insert_member" ON public.openfinance_transactions FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "oft_update_member" ON public.openfinance_transactions FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_openfinance_transactions_updated_at BEFORE UPDATE ON public.openfinance_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.openfinance_transactions(id) ON DELETE CASCADE,
  financial_transaction_id uuid NULL REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'SUGGESTED' CHECK (status IN ('SUGGESTED','CONFIRMED','IGNORED','CANCELED')),
  confidence_score numeric(5,2) NULL,
  matched_by text NOT NULL DEFAULT 'SYSTEM' CHECK (matched_by IN ('SYSTEM','MANUAL')),
  confirmed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_br_company ON public.bank_reconciliations(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_reconciliations TO authenticated;
GRANT ALL ON public.bank_reconciliations TO service_role;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br_select_member" ON public.bank_reconciliations FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "br_insert_member" ON public.bank_reconciliations FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "br_update_member" ON public.bank_reconciliations FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_bank_reconciliations_updated_at BEFORE UPDATE ON public.bank_reconciliations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.openfinance_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NULL,
  event_type text NULL,
  connection_id uuid NULL REFERENCES public.openfinance_connections(id) ON DELETE SET NULL,
  company_id uuid NULL REFERENCES public.companies(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','DUPLICATE','ERROR','IGNORED')),
  processed_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofwe_provider_event ON public.openfinance_webhook_events(provider, event_id) WHERE event_id IS NOT NULL;
GRANT SELECT ON public.openfinance_webhook_events TO authenticated;
GRANT ALL ON public.openfinance_webhook_events TO service_role;
ALTER TABLE public.openfinance_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ofwe_select_company_admin" ON public.openfinance_webhook_events FOR SELECT TO authenticated USING (
  company_id IS NOT NULL AND public.is_company_member(company_id)
  AND (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);

ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS openfinance_transaction_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_fin_tx_oft ON public.financial_transactions(openfinance_transaction_id) WHERE openfinance_transaction_id IS NOT NULL;

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('finance.openfinance.view',     'finance', 'openfinance.view',     'Visualizar Open Finance'),
  ('finance.openfinance.connect',  'finance', 'openfinance.connect',  'Conectar conta bancária via Open Finance'),
  ('finance.openfinance.manage',   'finance', 'openfinance.manage',   'Gerenciar conexões Open Finance'),
  ('finance.openfinance.revoke',   'finance', 'openfinance.revoke',   'Revogar consentimento Open Finance'),
  ('finance.reconciliation.view',  'finance', 'reconciliation.view',  'Visualizar conciliação bancária'),
  ('finance.reconciliation.manage','finance', 'reconciliation.manage','Confirmar conciliação bancária'),
  ('finance.bank_accounts.view',   'finance', 'bank_accounts.view',   'Visualizar contas bancárias'),
  ('finance.bank_accounts.manage', 'finance', 'bank_accounts.manage', 'Gerenciar contas bancárias')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('owner','financial')
  AND p.slug IN (
    'finance.openfinance.view','finance.openfinance.connect','finance.openfinance.manage','finance.openfinance.revoke',
    'finance.reconciliation.view','finance.reconciliation.manage',
    'finance.bank_accounts.view','finance.bank_accounts.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
