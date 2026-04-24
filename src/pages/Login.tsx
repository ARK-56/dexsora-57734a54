import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, Link } from "react-router-dom";
import dexsoraLogo from "@/assets/dexsora-logo.png";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000;

type Step = "credentials" | "email_code" | "totp" | "forgot_password";

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const attemptsRef = useRef(0);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2FA state
  const [step, setStep] = useState<Step>("credentials");
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (user) {
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

    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-login-code", {
        body: { email, password },
      });

      if (fnError) throw fnError;

      if (data?.error) {
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
          setError(`${data.error} (${MAX_ATTEMPTS - attemptsRef.current} attempts remaining)`);
        }
        setSubmitting(false);
        return;
      }

      attemptsRef.current = 0;
      setSavedEmail(email);
      setSavedPassword(password);

      if (data?.mfa === "totp") {
        // User has TOTP enrolled — show authenticator code input
        setStep("totp");
      } else {
        // Email code was sent
        startCooldown();
        setStep("email_code");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Failed to verify credentials. Please try again.");
    }
    setSubmitting(false);
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
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
        const { error: finalError } = await signIn(savedEmail, savedPassword);
        if (finalError) {
          setError("Verification succeeded but sign-in failed. Please try again.");
        }
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError("Verification failed. Please try again.");
    }
    setVerifying(false);
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    try {
      // Sign in first to get aal1 session
      const { error: signInError } = await signIn(savedEmail, savedPassword);
      if (signInError) {
        setError("Sign-in failed. Please try again.");
        setVerifying(false);
        return;
      }

      // Now verify TOTP to elevate to aal2
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactor = factorsData?.totp?.find((f: any) => f.status === "verified");

      if (!totpFactor) {
        setError("No authenticator found. Please try again.");
        await supabase.auth.signOut();
        setVerifying(false);
        return;
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        setError("Invalid authenticator code. Please try again.");
        await supabase.auth.signOut();
        setVerifying(false);
        return;
      }

      // MFA verified — user will be redirected by the auth state change
    } catch (err: any) {
      console.error("TOTP verification error:", err);
      setError("Authenticator verification failed. Please try again.");
      try { await supabase.auth.signOut(); } catch {}
    }
    setVerifying(false);
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    setError(null);
    setSendingCode(true);
    try {
      await supabase.functions.invoke("send-login-code", {
        body: { email: savedEmail, password: savedPassword },
      });
      setError(null);
      startCooldown();
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

        {step === "credentials" && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-base font-medium text-white/70">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-lg text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-white/70">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-lg text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || locked || sendingCode}
              className="h-10 w-full rounded-lg bg-white text-lg font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {locked ? "Locked — Wait 1 min" : submitting || sendingCode ? "Verifying..." : "Sign In"}
            </button>
          </form>
        )}

        {step === "email_code" && (
          <form onSubmit={handleVerifyEmailCode} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
            <div className="text-center space-y-1">
              <p className="text-lg font-medium text-white">Check your email</p>
              <p className="text-base text-white/60">
                We sent a 6-digit code to <span className="font-medium text-white/80">{savedEmail}</span>
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-base font-medium text-white/70">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className="h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-center text-2xl font-mono tracking-[0.3em] text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="h-10 w-full rounded-lg bg-white text-lg font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-base text-white/60 hover:text-white transition-colors"
              >
                ← Back to login
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={sendingCode || cooldown > 0}
                className="text-base text-white/60 hover:text-white transition-colors disabled:opacity-50"
              >
                {sendingCode ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "totp" && (
          <form onSubmit={handleVerifyTotp} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
            <div className="text-center space-y-1">
              <p className="text-lg font-medium text-white">Authenticator Code</p>
              <p className="text-base text-white/60">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Authenticator Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className="h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-center text-xl font-mono tracking-[0.3em] text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="h-10 w-full rounded-lg bg-white text-base font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify & Sign In"}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full text-sm text-white/60 hover:text-white transition-colors"
            >
              ← Back to login
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Login;
