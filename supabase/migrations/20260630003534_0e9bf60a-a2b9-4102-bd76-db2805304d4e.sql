CREATE POLICY "Tenants insert own pilot feedback" ON public.pilot_feedback FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND submitted_by = auth.uid());

CREATE POLICY "Tenants read own company pilot feedback" ON public.pilot_feedback FOR SELECT TO authenticated USING (company_id = public.current_company_id());