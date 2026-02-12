import { Lead, LeadStatus } from "@/types/lead";
import { FileText, Clock, CheckCircle, Package, AlertTriangle } from "lucide-react";

interface StatsBarProps {
  leads: Lead[];
}

const statuses: { status: LeadStatus | "denied"; label: string; icon: React.ReactNode }[] = [
  { status: "Pending", label: "Pending", icon: <Clock className="h-5 w-5" /> },
  { status: "Open", label: "Open (SNS)", icon: <FileText className="h-5 w-5" /> },
  { status: "Auth", label: "Auth", icon: <FileText className="h-5 w-5" /> },
  { status: "Approved", label: "Approved", icon: <CheckCircle className="h-5 w-5" /> },
  { status: "Delivered", label: "Delivered", icon: <Package className="h-5 w-5" /> },
  { status: "denied", label: "Denied", icon: <AlertTriangle className="h-5 w-5" /> },
];

export const StatsBar = ({ leads }: StatsBarProps) => {
  const getCount = (status: LeadStatus | "denied") => {
    if (status === "denied") {
      return leads.filter((l) => l.status.startsWith("Denied")).length;
    }
    return leads.filter((l) => l.status === status).length;
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {statuses.map((s) => {
        const count = getCount(s.status);
        const isDenied = s.status === "denied";
        return (
          <div
            key={s.status}
            className={`flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md ${
              isDenied ? "border-destructive/20" : "border-border"
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isDenied
                  ? "bg-destructive/10 text-destructive"
                  : s.status === "Approved" || s.status === "Delivered"
                  ? "bg-success/10 text-success"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
