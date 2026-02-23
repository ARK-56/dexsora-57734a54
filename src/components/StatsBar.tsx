import { DbLead } from "@/hooks/useLeads";
import { LeadStatus } from "@/types/lead";
import { Clock, CheckCircle, Package, AlertTriangle } from "lucide-react";

interface StatsBarProps {
  leads: DbLead[];
}

const statuses: { status: LeadStatus | "new"; label: string; icon: React.ReactNode }[] = [
  { status: "new", label: "New Patients/Pending", icon: <Clock className="h-4 w-4" /> },
  { status: "Eligible", label: "Need to Ship", icon: <CheckCircle className="h-4 w-4" /> },
  { status: "Shipped", label: "Shipped", icon: <Package className="h-4 w-4" /> },
];

export const StatsBar = ({ leads }: StatsBarProps) => {
  const getCount = (status: LeadStatus | "new") => {
    if (status === "new") {
      return leads.filter((l) => l.status === "New Lead" || l.status === "Pending").length;
    }
    return leads.filter((l) => l.status === status).length;
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {statuses.map((s) => {
        const count = getCount(s.status);
        return (
          <div
            key={s.status}
            className="flex items-center gap-2.5 rounded-lg swoosh-gradient px-3 py-3 transition-shadow hover:shadow-md"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/20 text-white">
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold font-display text-white leading-none">{count}</p>
              <p className="text-[10px] text-white/80 mt-0.5">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
