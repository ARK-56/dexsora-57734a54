-- Allow super_admins to view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super_admins to view all user roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super_admins to view all lead documents
CREATE POLICY "Super admins can view all lead documents"
ON public.lead_documents
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super_admins to view all notifications
CREATE POLICY "Super admins can view all notifications"
ON public.notifications
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super_admins to view audit logs
CREATE POLICY "Super admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));