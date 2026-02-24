import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ArrowLeft, Camera, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TotpSetup } from "@/components/TotpSetup";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const Profile = () => {
  const { user, profile, loading, refreshProfile, isSuperAdmin, hasAdminAccess, isDoctor } = useAuth();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordStep, setPasswordStep] = useState<"form" | "verify">("form");
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadAvatar = async () => {
      const url = (profile as any)?.avatar_url;
      if (!url) return;
      if (!url.startsWith("http")) {
        const { data } = await supabase.storage.from("avatars").createSignedUrl(url, 3600);
        if (data?.signedUrl) setAvatarUrl(data.signedUrl);
      } else {
        setAvatarUrl(url);
      }
    };
    loadAvatar();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isSuperAdmin) return <Navigate to="/super-admin" replace />;

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

    const newUrl = filePath;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("user_id", user.id);

    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
    } else {
      const { data: signedData } = await supabase.storage.from("avatars").createSignedUrl(filePath, 3600);
      setAvatarUrl(signedData?.signedUrl || filePath);
      await refreshProfile();
      toast({ title: "Avatar updated", description: "Your profile picture has been saved." });
    }
    setUploading(false);
  };

  const handleSendPasswordCode = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Error", description: "Please fill in all password fields.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setSendingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("change-password", {
        body: { action: "send_code", email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Code sent", description: "A verification code has been sent to your email." });
      setPasswordStep("verify");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send code", variant: "destructive" });
    }
    setSendingCode(false);
  };

  const handleVerifyAndChangePassword = async () => {
    if (verificationCode.length !== 6) {
      toast({ title: "Error", description: "Please enter the 6-digit code.", variant: "destructive" });
      return;
    }
    setUpdatingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("change-password", {
        body: { action: "verify_and_change", email, code: verificationCode, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setPasswordStep("form");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    }
    setUpdatingPassword(false);
  };

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
            <p className="text-sm text-muted-foreground">Manage your profile picture</p>
          </div>
        </div>

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

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>

          {passwordStep === "form" ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">New Password</label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm Password</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button onClick={handleSendPasswordCode} disabled={sendingCode} className="w-full">
                {sendingCode ? "Sending code..." : "Update Password"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                A verification code has been sent to <span className="font-medium text-foreground">{email}</span>. Enter it below to confirm your password change.
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verificationCode} onChange={setVerificationCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setPasswordStep("form"); setVerificationCode(""); }} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleVerifyAndChangePassword} disabled={updatingPassword} className="flex-1">
                  {updatingPassword ? "Changing..." : "Confirm"}
                </Button>
              </div>
            </>
          )}
        </div>

        <TotpSetup />
      </main>
    </div>
  );
};

export default Profile;
