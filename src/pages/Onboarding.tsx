import { useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLAN_LABELS: Record<string, string> = {
  single_monthly: "Single Org — $100/mo",
  single_yearly: "Single Org — $1,200/yr",
  multi_monthly: "Multi Org — $500/mo",
  multi_yearly: "Multi Org — $6,000/yr",
};

const Onboarding = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const { toast } = useToast();

  const [orgName, setOrgName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to={`/signup?plan=${plan}`} replace />;

  if (!plan || !PLAN_LABELS[plan]) {
    return <Navigate to="/pricing" replace />;
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = orgName.trim().replace(/[<>{}]/g, "");
    if (!trimmed || trimmed.length > 100) {
      setError("Please enter a valid organization name (max 100 characters)");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: { priceKey: plan, orgName: trimmed },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No checkout URL received");

      // Redirect to Stripe
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || "Failed to start checkout");
      setSubmitting(false);
      toast({
        title: "Checkout Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-6 text-center">
          <img alt="Dexsora" className="mx-auto h-16 mb-2" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />
          <div className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 border border-white/10">
            {PLAN_LABELS[plan]}
          </div>
        </div>

        <form onSubmit={handleCheckout} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-8 shadow-xl space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Name your organization</h2>
            <p className="mt-1 text-sm text-white/60">
              This will be the name of your first organization on Dexsora.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/70">Organization Name</label>
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

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-[hsl(183,100%,25%)] hover:bg-white/90 disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Redirecting to checkout...
              </span>
            ) : (
              "Continue to Payment"
            )}
          </Button>

          <p className="text-center text-xs text-white/40">
            You'll be redirected to Stripe for secure payment
          </p>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
