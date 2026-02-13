
-- Add is_read column to lead_notes for read/unread tracking
ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
