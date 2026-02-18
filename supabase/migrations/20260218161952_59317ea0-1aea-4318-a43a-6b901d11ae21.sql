
-- Add address and phone to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS phone text DEFAULT '';

-- Create org_items table for admin-managed item dropdown options
CREATE TABLE public.org_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.org_items ENABLE ROW LEVEL SECURITY;

-- Org members can view items in their org
CREATE POLICY "Org members can view org items"
ON public.org_items FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

-- Org admins can insert items
CREATE POLICY "Org admins can insert org items"
ON public.org_items FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), organization_id));

-- Org admins can delete items
CREATE POLICY "Org admins can delete org items"
ON public.org_items FOR DELETE
USING (is_org_admin(auth.uid(), organization_id));

-- Org admins can update items
CREATE POLICY "Org admins can update org items"
ON public.org_items FOR UPDATE
USING (is_org_admin(auth.uid(), organization_id));

-- Admin roles can manage items too
CREATE POLICY "Admin roles can view all org items"
ON public.org_items FOR SELECT
USING (has_admin_access(auth.uid()));

CREATE POLICY "Admin roles can insert org items"
ON public.org_items FOR INSERT
WITH CHECK (has_admin_access(auth.uid()));

CREATE POLICY "Admin roles can delete org items"
ON public.org_items FOR DELETE
USING (has_admin_access(auth.uid()));

-- Super admins
CREATE POLICY "Super admins can view all org items"
ON public.org_items FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));
