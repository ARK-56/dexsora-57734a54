
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert policy: allow the trigger/function to insert (via security definer)
-- No direct user inserts allowed
CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (false);

-- Create index for efficient querying
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);

-- Security definer function to insert audit logs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  _user_id uuid,
  _action text,
  _entity_type text,
  _entity_id text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, _action, _entity_type, _entity_id, _details);
END;
$$;

-- Trigger function: log lead status changes
CREATE OR REPLACE FUNCTION public.audit_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM insert_audit_log(
      auth.uid(),
      'status_change',
      'lead',
      NEW.id::text,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'patient_name', NEW.patient_name
      )
    );
  END IF;
  
  -- Log soft delete
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM insert_audit_log(
      auth.uid(),
      'soft_delete',
      'lead',
      NEW.id::text,
      jsonb_build_object('patient_name', NEW.patient_name)
    );
  END IF;
  
  -- Log restore
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    PERFORM insert_audit_log(
      auth.uid(),
      'restore',
      'lead',
      NEW.id::text,
      jsonb_build_object('patient_name', NEW.patient_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function: log lead creation
CREATE OR REPLACE FUNCTION public.audit_lead_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM insert_audit_log(
    COALESCE(auth.uid(), NEW.submitted_by),
    'create',
    'lead',
    NEW.id::text,
    jsonb_build_object(
      'patient_name', NEW.patient_name,
      'doctor_name', NEW.doctor_name
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger function: log lead permanent delete
CREATE OR REPLACE FUNCTION public.audit_lead_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM insert_audit_log(
    auth.uid(),
    'permanent_delete',
    'lead',
    OLD.id::text,
    jsonb_build_object('patient_name', OLD.patient_name)
  );
  RETURN OLD;
END;
$$;

-- Trigger function: log role changes
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      auth.uid(),
      'role_assigned',
      'user_role',
      NEW.user_id::text,
      jsonb_build_object('role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_log(
      auth.uid(),
      'role_removed',
      'user_role',
      OLD.user_id::text,
      jsonb_build_object('role', OLD.role)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers
CREATE TRIGGER audit_lead_status_change_trigger
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.audit_lead_status_change();

CREATE TRIGGER audit_lead_create_trigger
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.audit_lead_create();

CREATE TRIGGER audit_lead_delete_trigger
BEFORE DELETE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.audit_lead_delete();

CREATE TRIGGER audit_role_change_trigger
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_role_change();
