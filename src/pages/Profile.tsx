import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ArrowLeft, Camera, Shield, Loader2, Check, X, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { user, profile, loading, refreshProfile, fullyAuthenticated } = useAuth();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TOTP MFA state
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ qr: string; secret: string; factorId: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  useEffect(() => {
    if (profile && (profile as any).avatar_url) {
      setAvatarUrl((profile as any).avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (user) fetchMfaFactors();
  }, [user]);

  const fetchMfaFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setMfaFactors(data?.totp || []);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !fullyAuthenticated) return <Navigate to="/login" replace />;

  const fullName = profile?.full_name || "";
  const email = profile?.email || "";

  const initials = fullName
    ? fullName.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : email?.[0]?.toUpperCase() || "?";

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Error", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const newUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("user_id", user.id);

    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
    } else {
      setAvatarUrl(newUrl);
      await refreshProfile();
      toast({ title: "Avatar updated", description: "Your profile picture has been saved." });
    }
    setUploading(false);
  };

  const handleEnrollTotp = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Google Authenticator",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setEnrolling(false);
      return;
    }

    setEnrollData({
      qr: data.totp.qr_code,
      secret: data.totp.secret,
      factorId: data.id,
    });
    setEnrolling(false);
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollData) return;
    setVerifying(true);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollData.factorId,
    });

    if (challengeError) {
      toast({ title: "Error", description: challengeError.message, variant: "destructive" });
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });

    if (verifyError) {
      toast({ title: "Error", description: verifyError.message, variant: "destructive" });
    } else {
      toast({ title: "MFA Enabled", description: "Google Authenticator has been set up successfully." });
      setEnrollData(null);
      setVerifyCode("");
      await fetchMfaFactors();
    }
    setVerifying(false);
  };

  const handleUnenroll = async (factorId: string) => {
    setUnenrolling(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "MFA Disabled", description: "Google Authenticator has been removed." });
      await fetchMfaFactors();
    }
    setUnenrolling(false);
  };

  const hasMfa = mfaFactors.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-6 lg:px-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your profile and security</p>
          </div>
        </div>

        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera className="h-6 w-6 text-primary-foreground" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadAvatar} className="hidden" />
          </div>
        </div>

        {uploading && (
          <p className="text-center text-sm text-muted-foreground">Uploading...</p>
        )}

        {/* Profile Info */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full Name</label>
            <p className="h-10 flex items-center rounded-lg border border-input bg-muted px-3 text-sm text-foreground">{fullName || "—"}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
            <p className="h-10 flex items-center rounded-lg border border-input bg-muted px-3 text-sm text-foreground">{email || "—"}</p>
          </div>
        </div>

        {/* TOTP MFA Section */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Two-Factor Authentication</h2>
              <p className="text-xs text-muted-foreground">
                {hasMfa ? "Google Authenticator is enabled" : "Add an extra layer of security"}
              </p>
            </div>
            {hasMfa && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Check className="h-3 w-3" /> Enabled
              </span>
            )}
          </div>

          {/* Existing factors */}
          {hasMfa && (
            <div className="space-y-2">
              {mfaFactors.map((factor) => (
                <div key={factor.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{factor.friendly_name || "Google Authenticator"}</p>
                    <p className="text-xs text-muted-foreground">Added {new Date(factor.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleUnenroll(factor.id)}
                    disabled={unenrolling}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Enrollment flow */}
          {!enrollData && !hasMfa && (
            <button
              onClick={handleEnrollTotp}
              disabled={enrolling}
              className="h-10 w-full rounded-lg border border-primary bg-primary/5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 flex items-center justify-center gap-2"
            >
              {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {enrolling ? "Setting up..." : "Set Up Google Authenticator"}
            </button>
          )}

          {enrollData && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">1. Scan this QR code with Google Authenticator:</p>
                <div className="flex justify-center bg-white rounded-lg p-4">
                  <img src={enrollData.qr} alt="QR Code" className="h-48 w-48" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Or enter this secret manually:</p>
                  <code className="block rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground break-all select-all">
                    {enrollData.secret}
                  </code>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">2. Enter the 6-digit code from the app:</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-12 w-full rounded-lg border border-input bg-background px-3 text-center text-lg font-mono font-bold tracking-[0.5em] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                  placeholder="000000"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setEnrollData(null); setVerifyCode(""); }}
                  className="h-10 flex-1 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyEnrollment}
                  disabled={verifying || verifyCode.length !== 6}
                  className="h-10 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {verifying ? "Verifying..." : "Verify & Enable"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
