-- =====================================================================
-- MIGRATION 2 — VISITAS TÉCNICAS: Storage bucket policies
-- =====================================================================

-- Helper: extrai UUID de um segmento do path do storage (1-indexed)
CREATE OR REPLACE FUNCTION public._visit_path_uuid(_name text, _seg integer)
RETURNS uuid
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_part text;
  v_uuid uuid;
BEGIN
  IF _name IS NULL OR _seg < 1 THEN RETURN NULL; END IF;
  v_part := split_part(_name, '/', _seg);
  IF v_part IS NULL OR v_part = '' THEN RETURN NULL; END IF;
  BEGIN
    v_uuid := v_part::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v_uuid;
END; $$;

ALTER FUNCTION public._visit_path_uuid(text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._visit_path_uuid(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._visit_path_uuid(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public._visit_path_uuid(text, integer) TO authenticated;

-- Helper: autoriza leitura de uma visita específica
CREATE OR REPLACE FUNCTION public.can_access_visit(_visit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.id = _visit_id
      AND v.deleted_at IS NULL
      AND v.company_id = public.current_company_id()
      AND (
        public.has_permission('visits.view')
        OR (public.has_permission('visits.view_assigned_only')
            AND v.assigned_technician_id = auth.uid())
      )
  );
$$;

ALTER FUNCTION public.can_access_visit(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_access_visit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_visit(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_visit(uuid) TO authenticated;

-- =====================================================================
-- POLICIES em storage.objects para o bucket 'visit-photos'
-- Estrutura de path: <company_id>/visits/<visit_id>/<file_name>
--   seg 1: company_id
--   seg 2: 'visits'
--   seg 3: visit_id
-- =====================================================================

-- SELECT: baixar arquivos de visitas autorizadas
CREATE POLICY "visit_photos_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND public._visit_path_uuid(name, 1) = public.current_company_id()
    AND public.can_access_visit(public._visit_path_uuid(name, 3))
  );

-- INSERT/UPDATE/DELETE: NENHUMA policy criada = tudo bloqueado para authenticated.
-- service_role continua podendo gravar (bypass RLS) via RPCs SECURITY DEFINER.
