
CREATE OR REPLACE FUNCTION public.next_quote_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr TEXT := to_char(now(), 'YYYY');
  prefix TEXT := 'ORC-' || yr || '-';
  next_seq INT;
  num TEXT;
  uid UUID := auth.uid();
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada.';
  END IF;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF NOT public.is_super_admin() AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'Usuário não autorizado para esta empresa.';
  END IF;

  SELECT COALESCE(MAX(
           NULLIF(regexp_replace(quote_number, '^' || prefix, ''), '')::INT
         ), 0) + 1
    INTO next_seq
    FROM public.quotes
    WHERE company_id = _company_id
      AND quote_number ~ ('^' || prefix || '[0-9]+$');
  num := prefix || lpad(next_seq::TEXT, 4, '0');
  RETURN num;
END $$;

REVOKE ALL ON FUNCTION public.next_quote_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_quote_number(uuid) TO authenticated;
