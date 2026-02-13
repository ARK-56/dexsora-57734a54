import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationPopup } from "./NotificationPopup";
import { ThemeToggle } from "./ThemeToggle";
import { Search, LogOut, Settings, FileText, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onOpenPrescriptions?: () => void;
}

export const Header = ({ searchQuery = "", onSearchChange, onOpenPrescriptions }: HeaderProps) => {
  const { profile, hasAdminAccess, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="AAA DME" className="h-10 w-auto" />
          <div className="hidden sm:block">
            <h1 className="font-display text-lg font-bold text-foreground leading-tight">Lead Portal</h1>
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
            className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            title="Trash"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trash</span>
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
          <NotificationPopup />

          <Link
            to="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground overflow-hidden"
            title="My Profile"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
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
