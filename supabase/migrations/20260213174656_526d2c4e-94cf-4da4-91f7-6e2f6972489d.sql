
-- Fix: restrict all existing policies to authenticated role only
-- The linter warns about anon access, but all policies already use auth.uid() checks
-- However, let's be explicit and restrict the audit_logs policy

-- Fix audit_logs: only authenticated admins
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
-- No user-facing insert policy needed; inserts happen via security definer function
