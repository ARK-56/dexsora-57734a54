
-- Allow users to soft-delete (update deleted_at) their own leads
CREATE POLICY "Users can update own leads"
  ON public.leads
  FOR UPDATE
  USING (auth.uid() = submitted_by)
  WITH CHECK (auth.uid() = submitted_by);
