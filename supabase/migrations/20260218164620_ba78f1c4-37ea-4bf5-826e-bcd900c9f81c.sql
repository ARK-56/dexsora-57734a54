CREATE POLICY "Org members can view their organization"
ON public.organizations
FOR SELECT
USING (user_belongs_to_org(auth.uid(), id));