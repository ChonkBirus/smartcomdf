-- Correção definitiva do fluxo de importação de clientes.
-- Mantém RLS ativa, libera importação para proprietário/admin e para papéis com permissão,
-- e permite CPF/CNPJ vazio sem colisão de índice único.

-- 1) Garantir slugs esperados pelo produto e compatibilidade com o módulo clients.
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('clients.import', 'clients', 'import', 'Importar clientes por CSV/XLSX'),
  ('clients.import.confirm', 'clients', 'import.confirm', 'Confirmar e executar importação de clientes'),
  ('clients.import.view_history', 'clients', 'import.view_history', 'Visualizar histórico de importações de clientes'),
  ('customers.import', 'customers', 'import', 'Alias: importar clientes por CSV/XLSX'),
  ('customers.import.confirm', 'customers', 'import.confirm', 'Alias: confirmar importação de clientes'),
  ('customers.import.view_history', 'customers', 'import.view_history', 'Alias: histórico de importações de clientes')
ON CONFLICT (slug) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

-- 2) Proprietário/admin, gerente e comercial devem conseguir importar.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('super_admin', 'owner', 'manager', 'commercial')
  AND p.slug IN (
    'clients.import', 'clients.import.confirm', 'clients.import.view_history',
    'customers.import', 'customers.import.confirm', 'customers.import.view_history'
  )
ON CONFLICT DO NOTHING;

-- 3) CPF/CNPJ continua opcional na importação; vazio não deve bloquear múltiplos clientes.
DROP INDEX IF EXISTS public.customers_company_doc_unique;
CREATE UNIQUE INDEX IF NOT EXISTS customers_company_doc_unique
  ON public.customers (company_id, cpf_cnpj)
  WHERE deleted_at IS NULL AND cpf_cnpj IS NOT NULL AND btrim(cpf_cnpj) <> '';

-- 4) RLS para inserir cliente importado na própria empresa sem desativar segurança.
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_super_admin()
      OR public.has_company_role('owner')
      OR public.has_permission('clients.create')
      OR public.has_permission('clients.import')
      OR public.has_permission('customers.import')
    )
  );

-- 5) RLS para endereço/contato criados pela importação na mesma empresa.
DROP POLICY IF EXISTS "customer_addresses_modify" ON public.customer_addresses;
CREATE POLICY "customer_addresses_modify" ON public.customer_addresses FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_super_admin()
      OR public.has_company_role('owner')
      OR public.has_permission('clients.create')
      OR public.has_permission('clients.edit')
      OR public.has_permission('clients.import')
      OR public.has_permission('customers.import')
    )
  );

DROP POLICY IF EXISTS "customer_contacts_modify" ON public.customer_contacts;
CREATE POLICY "customer_contacts_modify" ON public.customer_contacts FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_super_admin()
      OR public.has_company_role('owner')
      OR public.has_permission('clients.create')
      OR public.has_permission('clients.edit')
      OR public.has_permission('clients.import')
      OR public.has_permission('customers.import')
    )
  );

-- 6) RLS dos jobs/linhas aceita o slug atual e o slug esperado, mantendo escopo por company_id.
DROP POLICY IF EXISTS "cij_insert_own_company" ON public.customer_import_jobs;
CREATE POLICY "cij_insert_own_company" ON public.customer_import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND created_by = auth.uid()
    AND (
      public.has_permission('clients.import')
      OR public.has_permission('customers.import')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS "cij_update_own_company" ON public.customer_import_jobs;
CREATE POLICY "cij_update_own_company" ON public.customer_import_jobs
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.has_permission('clients.import')
      OR public.has_permission('customers.import')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
  )
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "cij_delete_own_company" ON public.customer_import_jobs;
CREATE POLICY "cij_delete_own_company" ON public.customer_import_jobs
  FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.has_permission('clients.import')
      OR public.has_permission('customers.import')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS "cir_insert_own_company" ON public.customer_import_rows;
CREATE POLICY "cir_insert_own_company" ON public.customer_import_rows
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.has_permission('clients.import')
      OR public.has_permission('customers.import')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS "cir_update_own_company" ON public.customer_import_rows;
CREATE POLICY "cir_update_own_company" ON public.customer_import_rows
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.has_permission('clients.import')
      OR public.has_permission('customers.import')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
  )
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "cir_delete_own_company" ON public.customer_import_rows;
CREATE POLICY "cir_delete_own_company" ON public.customer_import_rows
  FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.has_permission('clients.import')
      OR public.has_permission('customers.import')
      OR public.has_company_role('owner')
      OR public.is_super_admin()
    )
  );