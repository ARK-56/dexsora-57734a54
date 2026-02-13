
CREATE TABLE public.prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view prescriptions"
  ON public.prescriptions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin roles can insert prescriptions"
  ON public.prescriptions FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'eligibility') OR
    public.has_role(auth.uid(), 'auth_team')
  );

CREATE POLICY "Admin roles can delete prescriptions"
  ON public.prescriptions FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'eligibility') OR
    public.has_role(auth.uid(), 'auth_team')
  );
