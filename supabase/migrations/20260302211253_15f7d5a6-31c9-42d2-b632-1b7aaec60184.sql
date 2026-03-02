
-- Create a public bucket for demo videos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('demo-videos', 'demo-videos', true, 104857600);

-- Allow anyone to view demo videos
CREATE POLICY "Public read access for demo videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'demo-videos');

-- Allow authenticated admins/super_admins to upload
CREATE POLICY "Admins can upload demo videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'demo-videos'
  AND public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Allow authenticated admins to delete
CREATE POLICY "Admins can delete demo videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'demo-videos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);
