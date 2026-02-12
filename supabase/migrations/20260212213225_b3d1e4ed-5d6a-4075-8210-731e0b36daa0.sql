-- Create leads table
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name text NOT NULL,
  dob text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  medicare_id text NOT NULL,
  ppo_id text DEFAULT '',
  dme_items text DEFAULT '',
  status text NOT NULL DEFAULT 'Pending',
  denial_reason text,
  tracking_number text,
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create lead_documents table
CREATE TABLE public.lead_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create lead_notes table
CREATE TABLE public.lead_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  text text NOT NULL,
  author text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- Leads policies: all authenticated users can view
CREATE POLICY "Authenticated users can view leads"
ON public.leads FOR SELECT TO authenticated
USING (true);

-- Any authenticated user can insert leads
CREATE POLICY "Authenticated users can insert leads"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (true);

-- Admin/eligibility/auth_team can update leads
CREATE POLICY "Admin access roles can update leads"
ON public.leads FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'eligibility'::app_role) OR
  has_role(auth.uid(), 'auth_team'::app_role)
);

-- Admin can delete leads
CREATE POLICY "Admins can delete leads"
ON public.leads FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Lead documents: all authenticated can view
CREATE POLICY "Authenticated users can view lead documents"
ON public.lead_documents FOR SELECT TO authenticated
USING (true);

-- Authenticated users can insert documents
CREATE POLICY "Authenticated users can insert lead documents"
ON public.lead_documents FOR INSERT TO authenticated
WITH CHECK (true);

-- Admin can delete documents
CREATE POLICY "Admins can delete lead documents"
ON public.lead_documents FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Lead notes: all authenticated can view
CREATE POLICY "Authenticated users can view lead notes"
ON public.lead_notes FOR SELECT TO authenticated
USING (true);

-- Authenticated can insert notes
CREATE POLICY "Authenticated users can insert lead notes"
ON public.lead_notes FOR INSERT TO authenticated
WITH CHECK (true);

-- Trigger for updated_at on leads
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;