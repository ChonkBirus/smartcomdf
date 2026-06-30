
CREATE TABLE public.bank_statement_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL,
  file_name       text NOT NULL,
  file_type       text NOT NULL,
  file_size       integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'UPLOADED'
                  CHECK (status IN ('UPLOADED','PARSING','PREVIEW','IMPORTED','FAILED','CANCELED')),
  imported_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_rows      integer NOT NULL DEFAULT 0,
  imported_rows   integer NOT NULL DEFAULT 0,
  duplicate_rows  integer NOT NULL DEFAULT 0,
  error_rows      integer NOT NULL DEFAULT 0,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bsi_company ON public.bank_statement_imports(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_imports TO authenticated;
GRANT ALL ON public.bank_statement_imports TO service_role;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bsi_select_member" ON public.bank_statement_imports
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "bsi_insert_member" ON public.bank_statement_imports
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "bsi_update_member" ON public.bank_statement_imports
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id))
                              WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "bsi_delete_member" ON public.bank_statement_imports
  FOR DELETE TO authenticated USING (public.is_company_member(company_id));

CREATE TRIGGER trg_bsi_updated BEFORE UPDATE ON public.bank_statement_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bank_statement_transactions (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  import_id                           uuid NOT NULL REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  bank_account_id                     uuid REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL,
  transaction_date                    date NOT NULL,
  description                         text NOT NULL DEFAULT '',
  amount                              numeric(14,2) NOT NULL,
  type                                text NOT NULL CHECK (type IN ('CREDIT','DEBIT')),
  document_number                     text,
  external_id                         text,
  transaction_hash                    text NOT NULL,
  category_suggestion                 text,
  reconciliation_status               text NOT NULL DEFAULT 'PENDING'
                                      CHECK (reconciliation_status IN ('PENDING','SUGGESTED','RECONCILED','IGNORED')),
  reconciled_financial_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  raw_payload                         jsonb,
  ignored_reason                      text,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bst_hash_unique UNIQUE (company_id, transaction_hash)
);
CREATE INDEX idx_bst_company ON public.bank_statement_transactions(company_id, transaction_date DESC);
CREATE INDEX idx_bst_import  ON public.bank_statement_transactions(import_id);
CREATE INDEX idx_bst_status  ON public.bank_statement_transactions(company_id, reconciliation_status);
CREATE INDEX idx_bst_account ON public.bank_statement_transactions(bank_account_id) WHERE bank_account_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_transactions TO authenticated;
GRANT ALL ON public.bank_statement_transactions TO service_role;
ALTER TABLE public.bank_statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bst_select_member" ON public.bank_statement_transactions
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "bst_insert_member" ON public.bank_statement_transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "bst_update_member" ON public.bank_statement_transactions
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id))
                              WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "bst_delete_member" ON public.bank_statement_transactions
  FOR DELETE TO authenticated USING (public.is_company_member(company_id));

CREATE TRIGGER trg_bst_updated BEFORE UPDATE ON public.bank_statement_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('finance.bank_import.view',   'finance', 'bank_import.view',   'Visualizar importações de extrato bancário'),
  ('finance.bank_import.manage', 'finance', 'bank_import.manage', 'Importar extrato bancário e gerenciar arquivos')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.slug IN ('finance.bank_import.view','finance.bank_import.manage')
 WHERE r.name IN ('Proprietário','Financeiro')
ON CONFLICT DO NOTHING;
