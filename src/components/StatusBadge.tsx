import { LeadStatus } from "@/types/lead";
import { cn } from "@/lib/utils";

const statusConfig: Record<LeadStatus, { bg: string; text: string; label: string }> = {
  "New Lead": { bg: "bg-primary", text: "text-primary-foreground", label: "NEW PATIENT" },
  Pending: { bg: "bg-warning", text: "text-warning-foreground", label: "PENDING" },
  Eligible: { bg: "bg-success", text: "text-success-foreground", label: "ELIGIBLE" },
  "Not Eligible": { bg: "bg-destructive", text: "text-destructive-foreground", label: "NOT ELIGIBLE" },
  "Need Additional Documents": { bg: "bg-warning", text: "text-warning-foreground", label: "NEED DOCS" },
  Shipped: { bg: "bg-primary", text: "text-primary-foreground", label: "SHIPPED" },
  Delivered: { bg: "bg-success", text: "text-success-foreground", label: "DELIVERED" },
  "Auth Applied": { bg: "bg-primary", text: "text-primary-foreground", label: "AUTH APPLIED" },
  "Auth Approved": { bg: "bg-success", text: "text-success-foreground", label: "AUTH APPROVED" },
  "Pre Payment Request": { bg: "bg-warning", text: "text-warning-foreground", label: "PRE PAYMENT" },
  "Post Payment Request": { bg: "bg-warning", text: "text-warning-foreground", label: "POST PAYMENT" },
  Billed: { bg: "bg-primary", text: "text-primary-foreground", label: "BILLED" },
  Paid: { bg: "bg-success", text: "text-success-foreground", label: "PAID" },
  Denied: { bg: "bg-destructive", text: "text-destructive-foreground", label: "DENIED" },
};

export const StatusBadge = ({ status }: { status: LeadStatus }) => {
  const config = statusConfig[status] || { bg: "bg-muted", text: "text-muted-foreground", label: status?.toUpperCase() || "UNKNOWN" };
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
