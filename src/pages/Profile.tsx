import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ArrowLeft, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile && (profile as any).avatar_url) {
      setAvatarUrl((profile as any).avatar_url);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

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
      </main>
    </div>
  );
};

export default Profile;
