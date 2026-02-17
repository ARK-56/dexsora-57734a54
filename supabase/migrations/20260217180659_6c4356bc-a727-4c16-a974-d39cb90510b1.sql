
-- Allow org members to insert prescriptions with their org_id
CREATE POLICY "Org members can insert org prescriptions"
ON public.prescriptions
FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL
  AND user_belongs_to_org(auth.uid(), organization_id)
  AND uploaded_by = auth.uid()
);

-- Allow org admins to delete org prescriptions
CREATE POLICY "Org admins can delete org prescriptions"
ON public.prescriptions
FOR DELETE
USING (
  organization_id IS NOT NULL
  AND is_org_admin(auth.uid(), organization_id)
);
