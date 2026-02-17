
-- 1. Add organization_id to leads
ALTER TABLE public.leads ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Add organization_id to lead_documents
ALTER TABLE public.lead_documents ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Add organization_id to lead_notes
ALTER TABLE public.lead_notes ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4. Add organization_id to prescriptions
ALTER TABLE public.prescriptions ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Add organization_id to notifications
ALTER TABLE public.notifications ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 6. Create index for org-scoped queries
CREATE INDEX idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX idx_lead_documents_organization_id ON public.lead_documents(organization_id);
CREATE INDEX idx_lead_notes_organization_id ON public.lead_notes(organization_id);
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(organization_id);

-- 7. Security definer function: check if user belongs to org (via org_members or ownership)
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND organization_id = _organization_id
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _organization_id AND owner_id = _user_id
  )
$$;

-- 8. Update leads RLS: add org-scoped policies
-- Org members can view leads in their org
CREATE POLICY "Org members can view org leads"
  ON public.leads FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id));

-- Org members can insert leads in their org
CREATE POLICY "Org members can insert org leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id) AND submitted_by = auth.uid());

-- Org admins can update org leads
CREATE POLICY "Org admins can update org leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id));

-- Org admins can delete org leads
CREATE POLICY "Org admins can delete org leads"
  ON public.leads FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id));

-- 9. Org-scoped lead_documents policies
CREATE POLICY "Org members can view org lead documents"
  ON public.lead_documents FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Org members can insert org lead documents"
  ON public.lead_documents FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id));

-- 10. Org-scoped lead_notes policies
CREATE POLICY "Org members can view org lead notes"
  ON public.lead_notes FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Org members can insert org lead notes"
  ON public.lead_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id));

-- 11. Org-scoped prescriptions policies
CREATE POLICY "Org members can view org prescriptions"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id));

-- 12. Org-scoped notifications policies
CREATE POLICY "Org members can view org notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id) AND user_id = auth.uid());

-- 13. Super admins can view all leads
CREATE POLICY "Super admins can view all leads"
  ON public.leads FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update all leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
