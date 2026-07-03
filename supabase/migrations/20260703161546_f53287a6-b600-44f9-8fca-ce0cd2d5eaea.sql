DROP POLICY IF EXISTS "avatars_read_authenticated" ON storage.objects;

CREATE POLICY "avatars_read_own_folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);