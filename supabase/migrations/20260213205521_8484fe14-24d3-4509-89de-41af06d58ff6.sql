
-- Allow doctors to mark notes as read on their own leads
CREATE POLICY "Lead owners can mark notes as read"
  ON public.lead_notes FOR UPDATE
  USING (
    owns_lead(auth.uid(), lead_id) AND is_internal = false
  )
  WITH CHECK (
    owns_lead(auth.uid(), lead_id) AND is_internal = false
  );
