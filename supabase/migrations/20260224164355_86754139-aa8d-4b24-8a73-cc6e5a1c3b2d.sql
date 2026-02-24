
-- Add invited_by column to org_members to track who invited each member
ALTER TABLE public.org_members ADD COLUMN invited_by uuid DEFAULT NULL;
