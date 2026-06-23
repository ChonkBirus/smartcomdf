REVOKE ALL ON FUNCTION public.quote_recalc_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quote_recalc_totals(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.quote_recalc_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_recalc_totals(uuid) TO service_role;