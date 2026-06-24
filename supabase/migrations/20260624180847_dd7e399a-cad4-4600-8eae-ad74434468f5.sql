
CREATE OR REPLACE FUNCTION public.so_collect_signature(
  _so_id UUID,
  _signature_type TEXT,
  _signer_name TEXT,
  _signature_file_url TEXT,
  _signer_document TEXT DEFAULT NULL,
  _signer_email TEXT DEFAULT NULL,
  _signer_phone TEXT DEFAULT NULL,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS public.service_order_signatures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_row public.service_order_signatures;
  v_has_perm BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.can_access_service_order(_so_id) THEN
    RAISE EXCEPTION 'forbidden_service_order';
  END IF;
  IF _signature_type NOT IN ('CUSTOMER','TECHNICIAN') THEN
    RAISE EXCEPTION 'invalid_signature_type';
  END IF;
  IF coalesce(btrim(_signer_name),'') = '' THEN
    RAISE EXCEPTION 'signer_name_required';
  END IF;
  IF coalesce(btrim(_signature_file_url),'') = '' THEN
    RAISE EXCEPTION 'signature_file_required';
  END IF;

  SELECT company_id INTO v_company FROM public.service_orders WHERE id = _so_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'service_order_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE pr.profile_id = v_uid
      AND pr.company_id = v_company
      AND p.slug = 'service_orders.collect_signature'
  ) INTO v_has_perm;
  IF NOT v_has_perm THEN
    RAISE EXCEPTION 'missing_permission_collect_signature';
  END IF;

  INSERT INTO public.service_order_signatures (
    company_id, service_order_id, signature_type, signer_name,
    signer_document, signer_email, signer_phone,
    signature_file_url, ip_address, user_agent, signed_at
  ) VALUES (
    v_company, _so_id, _signature_type, btrim(_signer_name),
    nullif(btrim(_signer_document),''),
    nullif(btrim(_signer_email),''),
    nullif(btrim(_signer_phone),''),
    _signature_file_url,
    _ip_address, _user_agent, now()
  )
  RETURNING * INTO v_row;

  IF _signature_type = 'CUSTOMER' THEN
    UPDATE public.service_orders
      SET customer_signed_at = now(), updated_at = now()
    WHERE id = _so_id;
  END IF;

  INSERT INTO public.service_order_execution_logs (
    company_id, service_order_id, user_id, action, notes, metadata
  ) VALUES (
    v_company, _so_id, v_uid,
    CASE WHEN _signature_type = 'CUSTOMER'
         THEN 'CUSTOMER_SIGNATURE_COLLECTED'
         ELSE 'TECHNICIAN_SIGNATURE_COLLECTED' END,
    'Assinatura de ' || btrim(_signer_name),
    jsonb_build_object('signature_id', v_row.id, 'signature_type', _signature_type)
  );

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.so_collect_signature(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.so_collect_signature(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
