
-- Fix 1: Make lead-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'lead-documents';

-- Fix 2: Restrict chat_participants INSERT to admin access only
DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.chat_participants;
CREATE POLICY "Admin users can add participants" ON public.chat_participants
  FOR INSERT WITH CHECK (has_admin_access(auth.uid()));

-- Fix 3: Enable RLS on login_verifications (currently has no policies)
CREATE POLICY "Users can view own verifications" ON public.login_verifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verifications" ON public.login_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
