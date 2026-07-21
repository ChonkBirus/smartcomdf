
-- customer_addresses
DROP POLICY IF EXISTS customer_addresses_modify ON public.customer_addresses;
CREATE POLICY customer_addresses_insert ON public.customer_addresses FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text) OR has_permission('clients.import'::text) OR has_permission('customers.import'::text)));
CREATE POLICY customer_addresses_update ON public.customer_addresses FOR UPDATE TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text) OR has_permission('clients.import'::text) OR has_permission('customers.import'::text)));
CREATE POLICY customer_addresses_delete ON public.customer_addresses FOR DELETE TO authenticated
  USING ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text) OR has_permission('clients.import'::text) OR has_permission('customers.import'::text)));

-- customer_contacts
DROP POLICY IF EXISTS customer_contacts_modify ON public.customer_contacts;
CREATE POLICY customer_contacts_insert ON public.customer_contacts FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text) OR has_permission('clients.import'::text) OR has_permission('customers.import'::text)));
CREATE POLICY customer_contacts_update ON public.customer_contacts FOR UPDATE TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text) OR has_permission('clients.import'::text) OR has_permission('customers.import'::text)));
CREATE POLICY customer_contacts_delete ON public.customer_contacts FOR DELETE TO authenticated
  USING ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text) OR has_permission('clients.import'::text) OR has_permission('customers.import'::text)));

-- customer_tag_relations
DROP POLICY IF EXISTS customer_tag_relations_modify ON public.customer_tag_relations;
CREATE POLICY customer_tag_relations_insert ON public.customer_tag_relations FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text)));
CREATE POLICY customer_tag_relations_update ON public.customer_tag_relations FOR UPDATE TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text)));
CREATE POLICY customer_tag_relations_delete ON public.customer_tag_relations FOR DELETE TO authenticated
  USING ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text)));

-- customer_tags
DROP POLICY IF EXISTS customer_tags_modify ON public.customer_tags;
CREATE POLICY customer_tags_insert ON public.customer_tags FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text)));
CREATE POLICY customer_tags_update ON public.customer_tags FOR UPDATE TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text)));
CREATE POLICY customer_tags_delete ON public.customer_tags FOR DELETE TO authenticated
  USING ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('clients.create'::text) OR has_permission('clients.edit'::text)));

-- quote_items
DROP POLICY IF EXISTS quote_items_all ON public.quote_items;
CREATE POLICY quote_items_select ON public.quote_items FOR SELECT TO authenticated
  USING ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('quotes.view'::text) OR has_permission('quotes.manage'::text)));
CREATE POLICY quote_items_insert ON public.quote_items FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('quotes.manage'::text)));
CREATE POLICY quote_items_update ON public.quote_items FOR UPDATE TO authenticated
  USING ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('quotes.manage'::text)))
  WITH CHECK ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('quotes.manage'::text)));
CREATE POLICY quote_items_delete ON public.quote_items FOR DELETE TO authenticated
  USING ((company_id = current_company_id()) AND (is_super_admin() OR has_company_role('owner'::app_role) OR has_permission('quotes.manage'::text)));
