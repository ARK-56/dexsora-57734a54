import { useState } from "react";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/contexts/OrgContext";

const Onboarding = () => {
  const { user, loading } = useAuth();
  const { refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "single_monthly";
  const { toast } = useToast();

  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/signup" replace />;

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const sanitize = (s: string) => s.replace(/[<>{}]/g, "").trim();
    const trimmed = sanitize(orgName);
    const address = sanitize(orgAddress);
    const phone = sanitize(orgPhone);

    if (!trimmed || trimmed.length > 100) {
      setError("Please enter a valid organization name (max 100 characters)");
      return;
    }
    if (!address || address.length > 300) {
      setError("Please enter a valid address (max 300 characters)");
      return;
    }
    if (!phone || !/^[\d\s()+-]+$/.test(phone)) {
      setError("Please enter a valid phone number");
      return;
    }

    setSubmitting(true);

    try {
      const planType = plan.startsWith("multi") ? "multi" : "single";

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: trimmed,
          owner_id: user.id,
          plan_type: planType,
          is_active: true,
          address,
          phone,
        })
        .select()
        .single();

      if (orgError) throw new Error(orgError.message);

      await supabase.from("org_members").insert({
        organization_id: org.id,
        user_id: user.id,
        role: "admin",
      });

      await supabase.from("subscriptions").insert({
        user_id: user.id,
        organization_id: org.id,
        plan_type: planType,
        status: "active",
      });

      await refreshOrgs();

      toast({ title: "Organization created!", description: "Welcome to Dexsora." });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-6 text-center">
          <img alt="Dexsora" className="mx-auto h-16 mb-2" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />
          <div className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 border border-white/10">
            Free Trial — Testing Mode
          </div>
        </div>

        <form onSubmit={handleCreateOrg} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-8 shadow-xl space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Set up your organization</h2>
            <p className="mt-1 text-sm text-white/60">
              Fill in your organization details to get started.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">Organization Name <span className="text-red-300">*</span></label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value.replace(/[<>{}]/g, ""))}
                required
                maxLength={100}
                className="h-11 w-full rounded-lg border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="e.g. Sunrise Medical Group"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">Address <span className="text-red-300">*</span></label>
              <input
                type="text"
                value={orgAddress}
                onChange={(e) => setOrgAddress(e.target.value.replace(/[<>{}]/g, ""))}
                required
                maxLength={300}
                className="h-11 w-full rounded-lg border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="e.g. 123 Main St, City, State ZIP"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">Phone No <span className="text-red-300">*</span></label>
              <input
                type="tel"
                value={orgPhone}
                onChange={(e) => setOrgPhone(e.target.value)}
                required
                maxLength={20}
                className="h-11 w-full rounded-lg border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="e.g. (555) 123-4567"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-[hsl(183,100%,25%)] hover:bg-white/90 disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating...
              </span>
            ) : (
              "Create Organization"
            )}
          </Button>

          <p className="text-center text-xs text-white/40">
            No payment required during testing
          </p>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
