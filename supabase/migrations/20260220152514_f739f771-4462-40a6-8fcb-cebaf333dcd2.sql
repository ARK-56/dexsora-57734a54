-- Backfill organization_id on lead_documents from their parent lead
UPDATE public.lead_documents ld
SET organization_id = l.organization_id
FROM public.leads l
WHERE ld.lead_id = l.id
  AND ld.organization_id IS NULL
  AND l.organization_id IS NOT NULL;

-- Add a policy so org admins can always see all documents on leads in their org
CREATE POLICY "Org admins can view all org lead documents via lead"
ON public.lead_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_documents.lead_id
      AND l.organization_id IS NOT NULL
      AND is_org_admin(auth.uid(), l.organization_id)
  )
);