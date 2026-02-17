import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const SetupAccount = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Check if user arrived via invite/recovery link (they'll be auto-signed in)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "");
        setChecking(false);
      } else {
        // Listen for auth state change (token might be processing)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
            setUserEmail(session?.user?.email || "");
            setChecking(false);
          }
        });
        // Timeout after 5 seconds
        setTimeout(() => setChecking(false), 5000);
        return () => subscription.unsubscribe();
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!fullName.trim() || fullName.length > 100) {
      setError("Please enter a valid name (1-100 characters).");
      return;
    }

    setSubmitting(true);
    try {
      // Update password
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      // Update profile name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("user_id", user.id);
        
        // Update user metadata to mark setup complete
        await supabase.auth.updateUser({
          data: { full_name: fullName.trim(), pending_setup: false },
        });

        // If user has NPI in metadata, update profile
        const npi = user.user_metadata?.npi;
        if (npi) {
          await supabase.from("profiles").update({ npi }).eq("user_id", user.id);
        }
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    }
    setSubmitting(false);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl text-center">
            <h2 className="text-lg font-bold text-white mb-2">Invalid or Expired Link</h2>
            <p className="text-sm text-white/70 mb-4">This setup link is no longer valid. Please contact your administrator for a new invitation.</p>
            <button
              onClick={() => navigate("/login")}
              className="h-10 w-full rounded-lg bg-white text-sm font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Account Setup Complete!</h2>
            <p className="text-sm text-white/70">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center flex flex-col items-center">
          <img alt="Dexsora" className="h-16 mb-2" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />
          <h2 className="text-lg font-bold text-white mt-2">Set Up Your Account</h2>
          <p className="text-sm text-white/60 mt-1">{userEmail}</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
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
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={100}
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="Your full name"
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
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/70">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-lg bg-white text-sm font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Setting up..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupAccount;
