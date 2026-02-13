import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Shield, Mail, KeyRound, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000;

type LoginStep = "credentials" | "email_otp" | "totp";

const Login = () => {
  const { user, loading, signIn, emailVerified, setEmailVerified } = useAuth();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [resending, setResending] = useState(false);
  const attemptsRef = useRef(0);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [totpChallengeId, setTotpChallengeId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user && emailVerified) return <Navigate to="/" replace />;

  const getAuthHeaders = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  };

  const sendEmailOtp = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-login-otp`,
      { method: "POST", headers }
    );
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to send verification code");
    }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) {
      setError("Too many failed attempts. Please wait 1 minute.");
      return;
    }

    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);

    if (error) {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setLocked(true);
        setError("Too many failed attempts. Please wait 1 minute.");
        lockTimerRef.current = setTimeout(() => {
          setLocked(false);
          attemptsRef.current = 0;
          setError(null);
        }, LOCKOUT_DURATION_MS);
      } else {
        setError(`${error} (${MAX_ATTEMPTS - attemptsRef.current} attempts remaining)`);
      }
    } else {
      try {
        await sendEmailOtp();
        setStep("email_otp");
      } catch (err: any) {
        setError(err.message);
      }
    }
    setSubmitting(false);
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError(null);
    try {
      await sendEmailOtp();
    } catch (err: any) {
      setError(err.message);
    }
    setResending(false);
  };

  const handleEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-login-otp`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ code: otpCode }),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      // Check for TOTP enrollment
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.nextLevel === "aal2" && aalData?.currentLevel === "aal1") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id });
          setTotpFactorId(totp.id);
          setTotpChallengeId(challenge?.id || null);
          setStep("totp");
          setSubmitting(false);
          return;
        }
      }

      // No TOTP → complete login
      setEmailVerified(true);
    } catch (err: any) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpFactorId || !totpChallengeId) return;
    setSubmitting(true);
    setError(null);

    const { error } = await supabase.auth.mfa.verify({
      factorId: totpFactorId,
      challengeId: totpChallengeId,
      code: totpCode,
    });

    if (error) {
      setError(error.message);
    } else {
      setEmailVerified(true);
    }
    setSubmitting(false);
  };

  const stepConfig = {
    credentials: {
      icon: <KeyRound className="h-5 w-5" />,
      title: "Sign In",
      subtitle: "Enter your credentials",
    },
    email_otp: {
      icon: <Mail className="h-5 w-5" />,
      title: "Email Verification",
      subtitle: `Enter the 6-digit code sent to ${email}`,
    },
    totp: {
      icon: <Shield className="h-5 w-5" />,
      title: "Authenticator Code",
      subtitle: "Enter the code from Google Authenticator",
    },
  };

  const current = stepConfig[step];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <img src={logo} alt="AAA DME" className="mx-auto h-16 w-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground">Lead Portal</h1>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(["credentials", "email_otp", "totp"] as LoginStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : i < ["credentials", "email_otp", "totp"].indexOf(step)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {current.icon}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{current.title}</h2>
              <p className="text-xs text-muted-foreground">{current.subtitle}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: Credentials */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || locked}
                className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {locked ? "Locked — Wait 1 min" : submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : "Continue"}
              </button>
            </form>
          )}

          {/* Step 2: Email OTP */}
          {step === "email_otp" && (
            <form onSubmit={handleEmailOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="h-12 w-full rounded-lg border border-input bg-background px-3 text-center text-lg font-mono font-bold tracking-[0.5em] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                  placeholder="000000"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={submitting || otpCode.length !== 6}
                className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                className="w-full text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {resending ? "Resending..." : "Didn't receive a code? Resend"}
              </button>
            </form>
          )}

          {/* Step 3: TOTP */}
          {step === "totp" && (
            <form onSubmit={handleTotp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Authenticator Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="h-12 w-full rounded-lg border border-input bg-background px-3 text-center text-lg font-mono font-bold tracking-[0.5em] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                  placeholder="000000"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={submitting || totpCode.length !== 6}
                className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify & Sign In"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
