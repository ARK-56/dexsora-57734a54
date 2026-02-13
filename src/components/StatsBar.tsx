import { DbLead } from "@/hooks/useLeads";
import { LeadStatus } from "@/types/lead";
import { Clock, FileText, CheckCircle, Package, AlertTriangle, DollarSign } from "lucide-react";

interface StatsBarProps {
  leads: DbLead[];
}

const statuses: { status: LeadStatus | "new"; label: string; icon: React.ReactNode; color: string }[] = [
  { status: "new", label: "New/Pending", icon: <Clock className="h-4 w-4" />, color: "text-warning bg-warning/10" },
  { status: "Eligible", label: "Eligible", icon: <CheckCircle className="h-4 w-4" />, color: "text-success bg-success/10" },
  { status: "Shipped", label: "Shipped", icon: <Package className="h-4 w-4" />, color: "text-primary bg-primary/10" },
  { status: "Delivered", label: "Delivered", icon: <Package className="h-4 w-4" />, color: "text-success bg-success/10" },
  { status: "Paid", label: "Paid", icon: <DollarSign className="h-4 w-4" />, color: "text-success bg-success/10" },
  { status: "Denied", label: "Denied", icon: <AlertTriangle className="h-4 w-4" />, color: "text-destructive bg-destructive/10" },
];

export const StatsBar = ({ leads }: StatsBarProps) => {
  const getCount = (status: LeadStatus | "new") => {
    if (status === "new") {
      return leads.filter((l) => l.status === "New Lead" || l.status === "Pending").length;
    }
    return leads.filter((l) => l.status === status).length;
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {statuses.map((s) => {
        const count = getCount(s.status);
        return (
          <div
            key={s.status}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-3 transition-shadow hover:shadow-sm"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold font-display text-foreground leading-none">{count}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
