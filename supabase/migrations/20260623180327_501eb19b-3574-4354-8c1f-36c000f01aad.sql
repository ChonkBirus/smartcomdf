DROP POLICY IF EXISTS "customers_select_own_company" ON public.customers;
CREATE POLICY "customers_select_own_company" ON public.customers
FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "customer_addresses_select" ON public.customer_addresses;
CREATE POLICY "customer_addresses_select" ON public.customer_addresses
FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "customer_contacts_select" ON public.customer_contacts;
CREATE POLICY "customer_contacts_select" ON public.customer_contacts
FOR SELECT TO authenticated
USING (company_id = public.current_company_id());