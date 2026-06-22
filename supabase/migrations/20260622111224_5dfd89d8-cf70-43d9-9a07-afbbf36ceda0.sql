
CREATE POLICY "nota_documents company read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nota-documents'
         AND (storage.foldername(name))[1] = public.current_company_id()::text);

CREATE POLICY "nota_documents company insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nota-documents'
              AND (storage.foldername(name))[1] = public.current_company_id()::text);

CREATE POLICY "nota_documents company update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'nota-documents'
         AND (storage.foldername(name))[1] = public.current_company_id()::text);

CREATE POLICY "nota_documents company delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nota-documents'
         AND (storage.foldername(name))[1] = public.current_company_id()::text);
