-- Add soft delete column
ALTER TABLE public.leads ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for filtering non-deleted leads
CREATE INDEX idx_leads_deleted_at ON public.leads (deleted_at);
