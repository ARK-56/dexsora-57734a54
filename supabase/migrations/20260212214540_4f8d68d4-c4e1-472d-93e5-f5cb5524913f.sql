
-- Allow users to delete their own submitted leads
CREATE POLICY "Users can delete own leads"
ON public.leads
FOR DELETE
USING (auth.uid() = submitted_by);

-- Fix lead_documents: ensure policies are PERMISSIVE (drop restrictive and recreate)
DROP POLICY IF EXISTS "Authenticated users can view lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Admins can delete lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Authenticated users can insert own lead documents" ON public.lead_documents;

CREATE POLICY "Anyone can view lead documents"
ON public.lead_documents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert lead documents"
ON public.lead_documents
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can delete lead documents"
ON public.lead_documents
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own lead documents"
ON public.lead_documents
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());
