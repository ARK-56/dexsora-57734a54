
-- Allow org admins/owners to insert notes on leads in their organization
CREATE POLICY "Org admins can insert notes on org leads"
ON public.lead_notes
FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id)
);
