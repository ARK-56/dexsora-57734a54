
-- 1. Make lead-documents bucket private (data encrypted at rest + access controlled)
UPDATE storage.buckets SET public = false WHERE id = 'lead-documents';

-- 2. Drop any existing permissive storage policies and create strict auth-only ones
DROP POLICY IF EXISTS "Authenticated upload to lead-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read from lead-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from lead-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read for lead-documents" ON storage.objects;

CREATE POLICY "Auth users can upload to lead-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lead-documents');

CREATE POLICY "Auth users can read lead-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lead-documents');

CREATE POLICY "Auth users can delete from lead-documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lead-documents');

-- 3. Create login_verifications table for email OTP
CREATE TABLE IF NOT EXISTS public.login_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.login_verifications ENABLE ROW LEVEL SECURITY;
-- No direct user RLS policies - only service role (edge functions) accesses this table

CREATE INDEX IF NOT EXISTS idx_login_verifications_user ON public.login_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_verifications_expiry ON public.login_verifications(expires_at);
