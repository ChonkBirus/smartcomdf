
INSERT INTO public.permissions (slug, module, action, description)
SELECT 'quotes.view_internal_values', 'quotes', 'view_internal_values',
       'Permite ver custo, margem e valores internos por item nos orçamentos.'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE slug = 'quotes.view_internal_values');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p2.id
FROM public.role_permissions rp
JOIN public.permissions p1 ON p1.id = rp.permission_id AND p1.slug = 'quotes.manage'
JOIN public.permissions p2 ON p2.slug = 'quotes.view_internal_values'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_quote_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q RECORD; c RECORD; co RECORD; items JSONB;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id, name, trade_name, corporate_name, cpf_cnpj
    INTO c FROM public.customers WHERE id = q.customer_id;

  SELECT corporate_name, trade_name, cnpj, email, phone, whatsapp, logo_url
    INTO co FROM public.companies WHERE id = q.company_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', qi.id,
           'name', qi.name,
           'description', qi.description,
           'kind', qi.kind,
           'quantity', qi.quantity,
           'unit', COALESCE(it.unit::text, 'UN'),
           'image_url', img.file_url,
           'position', qi.position
         ) ORDER BY qi.position, qi.created_at), '[]'::jsonb)
    INTO items
    FROM public.quote_items qi
    LEFT JOIN public.items it ON it.id = qi.item_id
    LEFT JOIN LATERAL (
      SELECT ii.file_url FROM public.item_images ii
      WHERE ii.item_id = qi.item_id
      ORDER BY ii.is_primary DESC, ii.created_at ASC
      LIMIT 1
    ) img ON TRUE
    WHERE qi.quote_id = q.id AND qi.kind <> 'LABOR';

  RETURN jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id, 'quote_number', q.quote_number, 'status', q.status, 'title', q.title,
      'issue_date', q.issue_date, 'valid_until', q.valid_until,
      'payment_terms', q.payment_terms, 'delivery_terms', q.delivery_terms,
      'warranty_terms', q.warranty_terms, 'completion_estimate', q.completion_estimate,
      'customer_notes', q.customer_notes, 'total_amount', q.total_amount,
      'accepted_at', q.accepted_at, 'accepted_by_name', q.accepted_by_name
    ),
    'customer', jsonb_build_object('name', COALESCE(c.trade_name, c.name, c.corporate_name), 'document', c.cpf_cnpj),
    'company', jsonb_build_object('name', COALESCE(co.trade_name, co.corporate_name),
                                  'cnpj', co.cnpj, 'email', co.email,
                                  'phone', co.phone, 'whatsapp', co.whatsapp, 'logo_url', co.logo_url),
    'items', items
  );
END $$;
