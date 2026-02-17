
-- 1. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  stripe_customer_id text,
  plan_type text NOT NULL DEFAULT 'single' CHECK (plan_type IN ('single', 'multi')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Owners can view own organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can update own organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admins can update all organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Organization members table
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'doctor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Security definer functions for org access
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND organization_id = _organization_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND organization_id = _organization_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _organization_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _organization_id AND owner_id = _user_id
  )
$$;

-- Org members RLS
CREATE POLICY "Super admins can view all org members"
  ON public.org_members FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Org members can view members in their org"
  ON public.org_members FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can add members"
  ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Org admins can update members"
  ON public.org_members FOR UPDATE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Org admins can delete members"
  ON public.org_members FOR DELETE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  plan_type text NOT NULL DEFAULT 'single' CHECK (plan_type IN ('single', 'multi')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'canceled', 'past_due', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update subscriptions"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Allow profiles to be viewed by org co-members
CREATE POLICY "Org members can view profiles of co-members"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om1
      JOIN public.org_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid() AND om2.user_id = profiles.user_id
    )
  );
