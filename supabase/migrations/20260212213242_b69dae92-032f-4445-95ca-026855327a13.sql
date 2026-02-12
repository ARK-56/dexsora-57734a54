-- Tighten insert policies to require submitted_by = auth.uid() for leads
DROP POLICY "Authenticated users can insert leads" ON public.leads;
CREATE POLICY "Authenticated users can insert own leads"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (submitted_by = auth.uid());

-- Tighten document insert to require uploaded_by = auth.uid()
DROP POLICY "Authenticated users can insert lead documents" ON public.lead_documents;
CREATE POLICY "Authenticated users can insert own lead documents"
ON public.lead_documents FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Tighten notes insert
DROP POLICY "Authenticated users can insert lead notes" ON public.lead_notes;
CREATE POLICY "Authenticated users can insert own lead notes"
ON public.lead_notes FOR INSERT TO authenticated
WITH CHECK (true);