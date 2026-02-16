import { useState, useEffect, useCallback, useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { NotificationPopup } from "./NotificationPopup";
import { ThemeToggle } from "./ThemeToggle";
import { Search, LogOut, Settings, FileText, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import dexsoraLogo from "@/assets/dexsora-logo.png";

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onOpenPrescriptions?: () => void;
  onNotificationClick?: (patientName: string) => void;
}

export const Header = ({ searchQuery = "", onSearchChange, onOpenPrescriptions, onNotificationClick }: HeaderProps) => {
  const { user, profile, hasAdminAccess, signOut } = useAuth();
  const [trashCount, setTrashCount] = useState(0);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const resolveAvatar = async () => {
      const url = profile?.avatar_url;
      if (!url) { setResolvedAvatarUrl(null); return; }
      if (!url.startsWith("http")) {
        const { data } = await supabase.storage.from("avatars").createSignedUrl(url, 3600);
        if (data?.signedUrl) setResolvedAvatarUrl(data.signedUrl);
      } else {
        setResolvedAvatarUrl(url);
      }
    };
    resolveAvatar();
  }, [profile?.avatar_url]);

  const fetchTrashCount = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null);
    if (!hasAdminAccess) {
      query = query.eq("submitted_by", user.id);
    }
    const { count } = await query;
    setTrashCount(count || 0);
  }, [user, hasAdminAccess]);

  useEffect(() => {
    fetchTrashCount();
    const channel = supabase
      .channel("trash-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchTrashCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTrashCount]);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 items-center justify-center rounded-lg swoosh-gradient px-2">
            <img src={dexsoraLogo} alt="Dexsora" className="h-6" />
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="h-9 w-64 rounded-lg border border-input bg-background pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
            />
          </div>

          <button
            onClick={onOpenPrescriptions}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            title="Prescriptions"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Prescriptions</span>
          </button>

          <Link
            to="/trash"
            className="relative flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            title="Trash"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trash</span>
            {trashCount > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {trashCount}
              </span>
            )}
          </Link>

          {hasAdminAccess && (
            <Link
              to="/admin"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          <ThemeToggle />
          <NotificationPopup onNotificationClick={onNotificationClick} />

          <Link
            to="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground overflow-hidden"
            title="My Profile"
          >
            {resolvedAvatarUrl ? (
              <img src={resolvedAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </Link>

          <button
            onClick={signOut}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-muted"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};
