
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Lead owners can mark notes as read" ON public.lead_notes;

-- Create as PERMISSIVE so doctors OR authors can update
CREATE POLICY "Lead owners can mark notes as read"
  ON public.lead_notes FOR UPDATE
  USING (
    owns_lead(auth.uid(), lead_id) AND is_internal = false
  )
  WITH CHECK (
    owns_lead(auth.uid(), lead_id) AND is_internal = false
  );

-- Also make the existing author update policy permissive
DROP POLICY IF EXISTS "Note authors can update own notes" ON public.lead_notes;

CREATE POLICY "Note authors can update own notes"
  ON public.lead_notes FOR UPDATE
  USING (
    (author = (SELECT profiles.full_name FROM profiles WHERE profiles.user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );
