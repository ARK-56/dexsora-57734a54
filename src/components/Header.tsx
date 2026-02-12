import logo from "@/assets/logo.png";
import { Bell, Search } from "lucide-react";
import { UserRole } from "@/types/lead";

const roleLabels: Record<UserRole, string> = {
  doctor: "Doctor Office",
  admin: "Admin",
  eligibility: "Eligibility Team",
  auth: "Auth Team",
  logistics: "Logistics Team",
};

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export const Header = ({ currentRole, onRoleChange }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="AAA DME" className="h-10 w-auto" />
          <div className="hidden sm:block">
            <h1 className="font-display text-lg font-bold text-foreground leading-tight">Lead Portal</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patients..."
              className="h-9 w-64 rounded-lg border border-input bg-background pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
            />
          </div>

          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground outline-none focus:border-primary"
          >
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-muted">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              3
            </span>
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            DR
          </div>
        </div>
      </div>
    </header>
  );
};
