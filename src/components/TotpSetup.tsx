import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

export const TotpSetup = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enrolledFactor, setEnrolledFactor] = useState<{ id: string; friendly_name?: string } | null>(null);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Unenroll state
  const [unenrolling, setUnenrolling] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totpFactor = data?.totp?.find((f: any) => f.status === "verified");
      setEnrolledFactor(totpFactor || null);
    } catch (err: any) {
      console.error("Failed to load MFA factors:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const handleStartEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Google Authenticator",
      });
      if (error) throw error;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start enrollment", variant: "destructive" });
      setEnrolling(false);
    }
  };

  const handleVerifyEnroll = async () => {
    if (verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      toast({ title: "Authenticator enabled", description: "Two-factor authentication is now active on your account." });
      setEnrolling(false);
      setQrCode("");
      setSecret("");
      setVerifyCode("");
      await loadFactors();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message || "Invalid code. Please try again.", variant: "destructive" });
    }
    setVerifying(false);
  };

  const handleCancelEnroll = async () => {
    if (factorId) {
      try {
        await supabase.auth.mfa.unenroll({ factorId });
      } catch {}
    }
    setEnrolling(false);
    setQrCode("");
    setSecret("");
    setVerifyCode("");
    setFactorId("");
  };

  const handleUnenroll = async () => {
    if (!enrolledFactor) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactor.id });
      if (error) throw error;
      toast({ title: "Authenticator removed", description: "Two-factor authentication has been disabled." });
      setEnrolledFactor(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to remove authenticator", variant: "destructive" });
    }
    setUnenrolling(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading security settings...</span>
        </div>
      </div>
    );
  }

  // Already enrolled — show status and option to remove
  if (enrolledFactor && !enrolling) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          <h2 className="text-sm font-semibold text-foreground">Authenticator App</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account is protected with an authenticator app. You'll be asked for a code from your app when you sign in.
        </p>
        <Button variant="destructive" size="sm" onClick={handleUnenroll} disabled={unenrolling}>
          {unenrolling ? "Removing..." : "Remove Authenticator"}
        </Button>
      </div>
    );
  }

  // Enrolling — show QR code
  if (enrolling && qrCode) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Set Up Authenticator</h2>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <div className="flex justify-center rounded-lg bg-white p-4">
            <img src={qrCode} alt="QR Code for authenticator" className="h-48 w-48" />
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              Can't scan? Enter this code manually
            </summary>
            <code className="mt-2 block break-all rounded bg-muted p-2 text-xs font-mono text-foreground select-all">
              {secret}
            </code>
          </details>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Enter the 6-digit code from your app
          </label>
          <Input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="text-center text-lg font-mono tracking-[0.3em]"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleVerifyEnroll} disabled={verifying || verifyCode.length !== 6} className="flex-1">
            {verifying ? "Verifying..." : "Verify & Enable"}
          </Button>
          <Button variant="outline" onClick={handleCancelEnroll}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Not enrolled — show option to set up
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldOff className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Authenticator App</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Add an extra layer of security by requiring a code from an authenticator app (like Google Authenticator) when you sign in.
      </p>
      <Button onClick={handleStartEnroll} variant="outline">
        <Shield className="mr-2 h-4 w-4" />
        Set Up Authenticator
      </Button>
    </div>
  );
};
