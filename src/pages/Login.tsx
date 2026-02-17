import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import dexsoraLogo from "@/assets/dexsora-logo.png";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const attemptsRef = useRef(0);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>);

  }

  if (user && user.user_metadata?.pending_setup) return <Navigate to="/setup-account" replace />;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (locked) {
      setError("Too many failed attempts. Please wait 1 minute before trying again.");
      return;
    }

    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);

    if (error) {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setLocked(true);
        setError(`Too many failed attempts. Please wait 1 minute before trying again.`);
        lockTimerRef.current = setTimeout(() => {
          setLocked(false);
          attemptsRef.current = 0;
          setError(null);
        }, LOCKOUT_DURATION_MS);
      } else {
        setError(`${error} (${MAX_ATTEMPTS - attemptsRef.current} attempts remaining)`);
      }
    } else {
      attemptsRef.current = 0;
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center flex flex-col items-center">
          <img alt="Dexsora" className="h-16 mb-2" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 shadow-xl space-y-4">
          {error &&
          <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
              {error}
            </div>
          }

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="you@company.com" />

          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/70">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/50 focus:ring-1 focus:ring-white/30"
              placeholder="••••••••" />

          </div>

          <button
            type="submit"
            disabled={submitting || locked}
            className="h-10 w-full rounded-lg bg-white text-sm font-semibold text-[hsl(183,100%,25%)] transition-opacity hover:opacity-90 disabled:opacity-50">

            {locked ? "Locked — Wait 1 min" : submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">Sign in to your account</p>
      </div>
    </div>);

};

export default Login;