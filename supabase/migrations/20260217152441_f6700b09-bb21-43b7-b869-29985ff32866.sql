
-- Fix storage policies to use authenticated role
-- First drop and recreate policies that allow anonymous access

-- Note: We can't easily list all storage policies, so we'll recreate the known ones
-- with TO authenticated

DROP POLICY IF EXISTS "Auth users can delete from lead-documents" ON storage.objects;
CREATE POLICY "Auth users can delete from lead-documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can read lead-documents" ON storage.objects;
CREATE POLICY "Auth users can read lead-documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete lead documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete lead documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated users can view lead documents" ON storage.objects;
CREATE POLICY "Authenticated users can view lead documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars are accessible to authenticated users" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Chat users can view attachments" ON storage.objects;
CREATE POLICY "Chat users can view attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
