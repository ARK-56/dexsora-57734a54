
-- Add NPI to profiles for doctors
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS npi text;

-- Add new lead fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS item text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS doctor_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS doctor_npi text;

-- Update default status to 'New Lead'
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'New Lead';

-- Function to auto-update stale "New Lead" to "Pending" after 2 days
CREATE OR REPLACE FUNCTION public.auto_update_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.leads
  SET status = 'Pending'
  WHERE status = 'New Lead'
    AND created_at < now() - interval '2 days'
    AND deleted_at IS NULL;
END;
$$;

-- Update RLS: allow shipment and billing roles to update leads
CREATE POLICY "Shipment role can update leads"
  ON public.leads
  FOR UPDATE
  USING (has_role(auth.uid(), 'shipment'::app_role));

CREATE POLICY "Billing role can update leads"
  ON public.leads
  FOR UPDATE
  USING (has_role(auth.uid(), 'billing'::app_role));
