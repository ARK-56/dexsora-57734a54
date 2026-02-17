import { useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PLAN_LABELS: Record<string, string> = {
  single_monthly: "Single Org — $100/mo",
  single_yearly: "Single Org — $1,200/yr",
  multi_monthly: "Multi Org — $500/mo",
  multi_yearly: "Multi Org — $6,000/yr",
};

const Signup = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  // If already logged in, redirect to onboarding with plan
  if (user) {
    return <Navigate to={`/onboarding?plan=${plan}`} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || fullName.length > 100) {
      setError("Please enter a valid name (max 100 characters)");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding?plan=${plan}`,
        data: { full_name: fullName.trim() },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    setEmailSent(true);
    setSubmitting(false);
    toast({ title: "Check your email", description: "We sent you a verification link." });
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <img alt="Dexsora" className="mx-auto h-16 mb-6" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-8">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-white/60 text-sm">
              We sent a verification link to <strong className="text-white">{email}</strong>.
              Click the link to verify your account and continue to checkout.
            </p>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="mt-6 text-sm text-white/50 hover:text-white/70 underline"
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 text-center">
          <img alt="Dexsora" className="mx-auto h-16 mb-2" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />
          {plan && PLAN_LABELS[plan] && (
            <div className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 border border-white/10">
              {PLAN_LABELS[plan]}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white text-center">Create your account</h2>

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/70">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value.replace(/[<>{}]/g, ""))}
              required
              maxLength={100}
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/70">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-white/40">Minimum 8 characters</p>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-lg bg-white text-sm font-semibold text-[hsl(183,100%,25%)] hover:bg-white/90 disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-white/50 hover:text-white/70 underline"
          >
            Already have an account? Sign in
          </button>
          <br />
          <button
            onClick={() => navigate("/pricing")}
            className="text-sm text-white/50 hover:text-white/70 underline"
          >
            ← Back to pricing
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
