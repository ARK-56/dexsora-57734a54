-- Function to permanently delete leads trashed more than 60 days ago
CREATE OR REPLACE FUNCTION public.cleanup_old_trashed_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.leads
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '60 days';
END;
$$;