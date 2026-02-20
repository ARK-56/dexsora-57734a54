
-- Create org_insurances table (mirrors org_items)
CREATE TABLE public.org_insurances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE public.org_insurances ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org members can view org insurances"
  ON public.org_insurances FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert org insurances"
  ON public.org_insurances FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can update org insurances"
  ON public.org_insurances FOR UPDATE
  USING (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete org insurances"
  ON public.org_insurances FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admin roles can view all org insurances"
  ON public.org_insurances FOR SELECT
  USING (has_admin_access(auth.uid()));

CREATE POLICY "Super admins can view all org insurances"
  ON public.org_insurances FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add insurance column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS insurance text NULL;
