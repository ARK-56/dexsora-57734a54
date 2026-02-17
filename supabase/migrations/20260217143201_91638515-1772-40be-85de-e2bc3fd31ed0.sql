
CREATE OR REPLACE FUNCTION public.audit_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      PERFORM insert_audit_log(
        auth.uid(),
        'role_assigned',
        'user_role',
        NEW.user_id::text,
        jsonb_build_object('role', NEW.role)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF auth.uid() IS NOT NULL THEN
      PERFORM insert_audit_log(
        auth.uid(),
        'role_removed',
        'user_role',
        OLD.user_id::text,
        jsonb_build_object('role', OLD.role)
      );
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
