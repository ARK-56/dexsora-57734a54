
-- FIX: lead_notes SELECT - hide internal notes from non-admin users (doctors)
DROP POLICY IF EXISTS "Users can view notes on accessible leads" ON public.lead_notes;

CREATE POLICY "Users can view notes on accessible leads"
ON public.lead_notes FOR SELECT TO authenticated
USING (
  -- Admin access users can see all notes
  (has_admin_access(auth.uid()))
  OR
  -- Lead owners can see non-internal notes only
  (owns_lead(auth.uid(), lead_id) AND is_internal = false)
);

-- FIX: prescriptions SELECT - restrict to relevant roles
DROP POLICY IF EXISTS "Anyone authenticated can view prescriptions" ON public.prescriptions;

CREATE POLICY "Authorized users can view prescriptions"
ON public.prescriptions FOR SELECT TO authenticated
USING (
  has_admin_access(auth.uid())
  OR has_role(auth.uid(), 'doctor'::app_role)
);
