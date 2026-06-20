
-- ============= STORAGE POLICIES =============

-- AVATARS: usuários veem qualquer avatar (autenticados), mas só gerenciam o próprio
CREATE POLICY "avatars_read_authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- COMPANY LOGOS: leitura por autenticados da mesma empresa ou super admin; gestão por owner
CREATE POLICY "logos_read_company" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (
      public.is_super_admin()
      OR (storage.foldername(name))[1] = public.current_company_id()::text
    )
  );
CREATE POLICY "logos_insert_owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_company_role('owner')
  );
CREATE POLICY "logos_update_owner" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_company_role('owner')
  );
CREATE POLICY "logos_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_company_role('owner')
  );

-- ============= ACCEPT INVITATION =============
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  uid UUID;
  uemail TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.user_invitations WHERE token = _token;
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Convite inválido.';
  END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Convite já utilizado ou revogado.';
  END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.user_invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'Convite expirado.';
  END IF;
  IF lower(inv.email) <> lower(uemail) THEN
    RAISE EXCEPTION 'Este convite foi enviado para outro e-mail.';
  END IF;

  UPDATE public.profiles SET company_id = inv.company_id WHERE id = uid;
  INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (uid, inv.company_id, inv.role)
    ON CONFLICT (user_id, company_id, role) DO NOTHING;
  UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = inv.id;

  RETURN inv.company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
