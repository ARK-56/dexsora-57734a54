-- Make avatars bucket private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Ensure lead-documents bucket is private
UPDATE storage.buckets SET public = false WHERE id = 'lead-documents';

-- Add UPDATE policy restriction for login_verifications (explicitly deny)
-- Already can't update/delete per current RLS, but add explicit cleanup function

-- Create function to auto-purge expired verification codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.login_verifications
  WHERE expires_at < now();
END;
$$;