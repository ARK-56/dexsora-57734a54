
-- Helper function: check if user has any admin-access role
CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'eligibility', 'auth_team', 'shipment', 'billing')
  )
$$;

-- Helper function: check if user owns a lead
CREATE OR REPLACE FUNCTION public.owns_lead(_user_id uuid, _lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = _lead_id AND submitted_by = _user_id
  )
$$;

-- ============================================================
-- FIX 1: leads SELECT - doctors see own, admin roles see all
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;

CREATE POLICY "Users can view own leads"
ON public.leads FOR SELECT TO authenticated
USING (
  submitted_by = auth.uid()
  OR has_admin_access(auth.uid())
);

-- ============================================================
-- FIX 2: lead_notes SELECT - only lead owner or admin roles
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view lead notes" ON public.lead_notes;

CREATE POLICY "Users can view notes on accessible leads"
ON public.lead_notes FOR SELECT TO authenticated
USING (
  has_admin_access(auth.uid())
  OR owns_lead(auth.uid(), lead_id)
);

-- ============================================================
-- FIX 3: lead_notes INSERT - only admin roles or lead owner
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert own lead notes" ON public.lead_notes;

CREATE POLICY "Users can insert notes on accessible leads"
ON public.lead_notes FOR INSERT TO authenticated
WITH CHECK (
  has_admin_access(auth.uid())
  OR owns_lead(auth.uid(), lead_id)
);

-- ============================================================
-- FIX 4: lead_documents SELECT - only lead owner or admin roles
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view lead documents" ON public.lead_documents;

CREATE POLICY "Users can view documents on accessible leads"
ON public.lead_documents FOR SELECT TO authenticated
USING (
  has_admin_access(auth.uid())
  OR owns_lead(auth.uid(), lead_id)
);

-- ============================================================
-- FIX 5: Add UPDATE policy for lead_notes (admin/author only)
-- ============================================================
CREATE POLICY "Note authors can update own notes"
ON public.lead_notes FOR UPDATE TO authenticated
USING (
  author = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================================
-- FIX 6: Add DELETE policy for lead_notes (admin only)
-- ============================================================
CREATE POLICY "Admins can delete notes"
ON public.lead_notes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
