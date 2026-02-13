
-- Trigger: notify user when their lead status is updated
CREATE OR REPLACE FUNCTION public.notify_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when status actually changed and lead has an owner
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
      NEW.submitted_by,
      'Lead Status Updated',
      'Lead for ' || NEW.patient_name || ' changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lead_status_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lead_status_change();

-- Trigger: notify all admin-access users when a new lead is added
CREATE OR REPLACE FUNCTION public.notify_admins_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  FOR admin_user_id IN
    SELECT DISTINCT user_id FROM public.user_roles
    WHERE role IN ('admin', 'eligibility', 'auth_team')
  LOOP
    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
      admin_user_id,
      'New Lead Submitted',
      'A new lead for ' || NEW.patient_name || ' has been submitted.'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_lead_submitted
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_lead();
