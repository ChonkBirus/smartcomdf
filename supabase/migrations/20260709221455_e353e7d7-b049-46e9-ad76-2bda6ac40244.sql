CREATE OR REPLACE FUNCTION public.validate_public_quote_image_paths(_token uuid, _paths text[])
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT qi.image_path), ARRAY[]::text[])
  FROM public.quotes q
  JOIN public.quote_items qi ON qi.quote_id = q.id
  WHERE q.public_token = _token
    AND qi.image_path = ANY(_paths);
$$;

REVOKE ALL ON FUNCTION public.validate_public_quote_image_paths(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_public_quote_image_paths(uuid, text[]) TO anon, authenticated, service_role;