import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, Link } from "react-router-dom";
import dexsoraLogo from "@/assets/dexsora-logo.png";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000;

const Login = () => {
  const { user, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const attemptsRef = useRef(0);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2FA state
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const blockRedirectRef = useRef(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  // Redirect when user is authenticated and we're not blocking (during credential validation before 2FA)
  if (user && !blockRedirectRef.current) {
    if (user.user_metadata?.pending_setup) return <Navigate to="/setup-account" replace />;
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (locked) {
      setError("Too many failed attempts. Please wait 1 minute before trying again.");
      return;
    }

    setError(null);
    setSubmitting(true);
    blockRedirectRef.current = true;

    // First validate credentials
    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      blockRedirectRef.current = false;
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setLocked(true);
        setError("Too many failed attempts. Please wait 1 minute before trying again.");
        lockTimerRef.current = setTimeout(() => {
          setLocked(false);
          attemptsRef.current = 0;
          setError(null);
        }, LOCKOUT_DURATION_MS);
      } else {
        setError(`${signInError} (${MAX_ATTEMPTS - attemptsRef.current} attempts remaining)`);
      }
      setSubmitting(false);
      return;
    }

    // Credentials valid — sign out and send code
    attemptsRef.current = 0;
    setSavedEmail(email);
    setSavedPassword(password);
    await signOut();

    setSendingCode(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-login-code", {
        body: { email },
      });
      if (fnError) throw fnError;
      setStep("code");
    } catch (err: any) {
      setError("Failed to send verification code. Please try again.");
    }
    setSendingCode(false);
    setSubmitting(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-login-code", {
        body: { email: savedEmail, code },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        setError(data.error);
        setVerifying(false);
        return;
      }

      if (data?.verified) {
        // Code verified — sign in for real, unblock redirect so auth state change triggers navigation
        blockRedirectRef.current = false;
        const { error: finalError } = await signIn(savedEmail, savedPassword);
        if (finalError) {
          blockRedirectRef.current = true;
          setError("Verification succeeded but sign-in failed. Please try again.");
        }
      }
    } catch (err: any) {
      setError("Verification failed. Please try again.");
    }
    setVerifying(false);
  };

  const handleResendCode = async () => {
    setError(null);
    setSendingCode(true);
    try {
      await supabase.functions.invoke("send-login-code", {
        body: { email: savedEmail },
      });
      setError(null);
    } catch {
      setError("Failed to resend code.");
    }
    setSendingCode(false);
  };

  const handleBackToLogin = () => {
    setStep("credentials");
    setCode("");
    setError(null);
    setSavedEmail("");
    setSavedPassword("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center flex flex-col items-center">
          <img alt="Dexsora" className="h-16 mb-2" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || locked || sendingCode}
              className="h-10 w-full rounded-lg bg-white text-sm font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {locked ? "Locked — Wait 1 min" : submitting || sendingCode ? "Verifying..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-white">Check your email</p>
              <p className="text-xs text-white/60">
                We sent a 6-digit code to <span className="font-medium text-white/80">{savedEmail}</span>
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className="h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-center text-lg font-mono tracking-[0.3em] text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="h-10 w-full rounded-lg bg-white text-sm font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                ← Back to login
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={sendingCode}
                className="text-xs text-white/60 hover:text-white transition-colors disabled:opacity-50"
              >
                {sendingCode ? "Sending..." : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-white/40">
          Don't have an account?{" "}
          <Link to="/signup" className="text-white/80 underline hover:text-white transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
