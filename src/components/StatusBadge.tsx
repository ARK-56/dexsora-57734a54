import { LeadStatus } from "@/types/lead";
import { cn } from "@/lib/utils";

const statusConfig: Record<LeadStatus, { className: string; icon: string }> = {
  Pending: { className: "bg-warning/15 text-warning border-warning/30", icon: "📋" },
  Open: { className: "bg-primary/10 text-primary border-primary/30", icon: "🔍" },
  Auth: { className: "bg-accent text-accent-foreground border-primary/30", icon: "📄" },
  Approved: { className: "bg-success/15 text-success border-success/30", icon: "✅" },
  Delivered: { className: "bg-success/20 text-success border-success/40", icon: "📦" },
  Closed: { className: "bg-muted text-muted-foreground border-border", icon: "📁" },
  "Denied (SNS)": { className: "bg-destructive/10 text-destructive border-destructive/30", icon: "⛔" },
  "Denied (Auth)": { className: "bg-destructive/10 text-destructive border-destructive/30", icon: "⛔" },
};

export const StatusBadge = ({ status }: { status: LeadStatus }) => {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        config.className
      )}
    >
      <span>{config.icon}</span>
      {status}
    </span>
  );
};
