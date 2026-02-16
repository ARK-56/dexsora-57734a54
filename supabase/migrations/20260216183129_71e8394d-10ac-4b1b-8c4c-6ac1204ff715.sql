-- Add is_admin_only flag to lead_documents
ALTER TABLE public.lead_documents 
ADD COLUMN is_admin_only boolean NOT NULL DEFAULT false;