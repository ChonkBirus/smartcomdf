
DO $$ BEGIN CREATE TYPE public.customer_type AS ENUM ('INDIVIDUAL','COMPANY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.customer_status AS ENUM ('LEAD','ACTIVE','INACTIVE','BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.customer_address_type AS ENUM ('BILLING','INSTALLATION','DELIVERY','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.customer_history_type AS ENUM ('NOTE','CALL','WHATSAPP','EMAIL','MEETING','SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_type public.customer_type NOT NULL DEFAULT 'INDIVIDUAL',
  name TEXT NOT NULL,
  corporate_name TEXT,
  trade_name TEXT,
  cpf_cnpj TEXT NOT NULL,
  state_registration TEXT,
  municipal_registration TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  customer_status public.customer_status NOT NULL DEFAULT 'ACTIVE',
  customer_origin TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS customers_company_doc_unique ON public.customers (company_id, cpf_cnpj) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS customers_company_idx ON public.customers (company_id);
CREATE INDEX IF NOT EXISTS customers_name_idx ON public.customers (lower(name));
CREATE INDEX IF NOT EXISTS customers_type_idx ON public.customers (customer_type);
CREATE INDEX IF NOT EXISTS customers_status_idx ON public.customers (customer_status);
CREATE INDEX IF NOT EXISTS customers_created_idx ON public.customers (created_at DESC);

CREATE POLICY "customers_select_own_company" ON public.customers FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('clients.create')));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('clients.edit') OR public.has_permission('clients.disable')));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('clients.delete')));

CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_type public.customer_address_type NOT NULL DEFAULT 'BILLING',
  zipcode TEXT, street TEXT, number TEXT, complement TEXT, district TEXT, city TEXT, state TEXT, reference TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx ON public.customer_addresses (customer_id);
CREATE INDEX IF NOT EXISTS customer_addresses_company_idx ON public.customer_addresses (company_id);
CREATE POLICY "customer_addresses_select" ON public.customer_addresses FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "customer_addresses_modify" ON public.customer_addresses FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('clients.create') OR public.has_permission('clients.edit')));
CREATE TRIGGER customer_addresses_set_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.customer_addresses_single_primary()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.customer_addresses SET is_primary = FALSE
      WHERE customer_id = NEW.customer_id AND id <> NEW.id AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customer_addresses_single_primary_trg AFTER INSERT OR UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.customer_addresses_single_primary();

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL, role TEXT, email TEXT, phone TEXT, whatsapp TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_contacts_customer_idx ON public.customer_contacts (customer_id);
CREATE INDEX IF NOT EXISTS customer_contacts_company_idx ON public.customer_contacts (company_id);
CREATE POLICY "customer_contacts_select" ON public.customer_contacts FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "customer_contacts_modify" ON public.customer_contacts FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('clients.create') OR public.has_permission('clients.edit')));
CREATE TRIGGER customer_contacts_set_updated_at BEFORE UPDATE ON public.customer_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.customer_contacts_single_primary()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.customer_contacts SET is_primary = FALSE
      WHERE customer_id = NEW.customer_id AND id <> NEW.id AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customer_contacts_single_primary_trg AFTER INSERT OR UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.customer_contacts_single_primary();

CREATE TABLE IF NOT EXISTS public.customer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  history_type public.customer_history_type NOT NULL DEFAULT 'NOTE',
  title TEXT NOT NULL, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_history TO authenticated;
GRANT ALL ON public.customer_history TO service_role;
ALTER TABLE public.customer_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_history_customer_idx ON public.customer_history (customer_id, created_at DESC);
CREATE POLICY "customer_history_select" ON public.customer_history FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "customer_history_insert" ON public.customer_history FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('clients.create') OR public.has_permission('clients.edit')));
CREATE POLICY "customer_history_delete" ON public.customer_history FOR DELETE TO authenticated
  USING (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner') OR public.has_permission('clients.delete')));

CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tags TO authenticated;
GRANT ALL ON public.customer_tags TO service_role;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_tags_company_idx ON public.customer_tags (company_id);
CREATE POLICY "customer_tags_select" ON public.customer_tags FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "customer_tags_modify" ON public.customer_tags FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('clients.create') OR public.has_permission('clients.edit')));

CREATE TABLE IF NOT EXISTS public.customer_tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tag_relations TO authenticated;
GRANT ALL ON public.customer_tag_relations TO service_role;
ALTER TABLE public.customer_tag_relations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_tag_relations_customer_idx ON public.customer_tag_relations (customer_id);
CREATE POLICY "customer_tag_relations_select" ON public.customer_tag_relations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "customer_tag_relations_modify" ON public.customer_tag_relations FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id()
    AND (public.is_super_admin() OR public.has_company_role('owner')
         OR public.has_permission('clients.create') OR public.has_permission('clients.edit')));

INSERT INTO public.permissions (module, slug, action, description) VALUES
  ('clients','clients.disable','disable','Pode desativar clientes'),
  ('clients','clients.export','export','Pode exportar lista de clientes'),
  ('clients','clients.history.view','view','Pode visualizar histórico do cliente')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
JOIN public.permissions p ON p.slug IN ('clients.disable','clients.export','clients.history.view')
WHERE r.slug IN ('owner','admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT pl.id, f.id, TRUE
FROM public.plans pl CROSS JOIN public.features f
WHERE f.code = 'customers'
ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = TRUE;
