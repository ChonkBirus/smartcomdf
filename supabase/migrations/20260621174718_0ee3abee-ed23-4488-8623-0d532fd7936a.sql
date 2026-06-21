-- product-images storage policies: path layout is "{company_id}/{product_id}/{file}"
CREATE POLICY "product_images_select_company" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "product_images_insert_company" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_permission('products.edit')
  );

CREATE POLICY "product_images_update_company" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_permission('products.edit')
  );

CREATE POLICY "product_images_delete_company" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_permission('products.edit')
  );
