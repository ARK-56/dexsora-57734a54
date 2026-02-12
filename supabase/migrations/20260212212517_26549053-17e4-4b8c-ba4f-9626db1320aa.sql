-- Create storage bucket for lead documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-documents', 'lead-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload lead documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lead-documents');

-- Allow authenticated users to view lead documents
CREATE POLICY "Authenticated users can view lead documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lead-documents');

-- Allow authenticated users to delete their uploaded documents
CREATE POLICY "Authenticated users can delete lead documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lead-documents');