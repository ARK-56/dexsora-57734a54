import { LeadStatus } from "@/types/lead";
import { cn } from "@/lib/utils";

const statusConfig: Record<LeadStatus, { bg: string; text: string; label: string }> = {
  Pending: { bg: "bg-warning", text: "text-warning-foreground", label: "PENDING" },
  Open: { bg: "bg-primary", text: "text-primary-foreground", label: "OPEN" },
  Auth: { bg: "bg-primary", text: "text-primary-foreground", label: "AUTH" },
  Approved: { bg: "bg-success", text: "text-success-foreground", label: "APPROVED" },
  Delivered: { bg: "bg-success", text: "text-success-foreground", label: "DELIVERED" },
  Closed: { bg: "bg-muted", text: "text-muted-foreground", label: "CLOSED" },
  "Denied (SNS)": { bg: "bg-destructive", text: "text-destructive-foreground", label: "DENIED" },
  "Denied (Auth)": { bg: "bg-destructive", text: "text-destructive-foreground", label: "DENIED" },
};

export const StatusBadge = ({ status }: { status: LeadStatus }) => {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-block rounded px-3 py-1 text-xs font-bold text-center min-w-[80px]",
        config.bg,
        config.text
      )}
    >
      {config.label}
    </span>
  );
};
