import { LeadStatus } from "@/types/lead";
import { ArrowRight, Sparkles, Clock, CheckCircle2, Package, Home } from "lucide-react";

const steps: { status: LeadStatus; label: string; icon: React.ReactNode }[] = [
  { status: "New Lead", label: "New Patient", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { status: "Pending", label: "Pending", icon: <Clock className="h-3.5 w-3.5" /> },
  { status: "Eligible", label: "Eligible", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { status: "Shipped", label: "Shipped", icon: <Package className="h-3.5 w-3.5" /> },
  { status: "Delivered", label: "Delivered", icon: <Home className="h-3.5 w-3.5" /> },
];

interface LifecycleBarProps {
  onStatusFilter?: (status: LeadStatus | "All") => void;
  activeStatus?: LeadStatus | "All";
}

export const LifecycleBar = ({ onStatusFilter, activeStatus }: LifecycleBarProps) => {
  return (
    <div className="hidden lg:flex items-center gap-0.5 rounded-xl swoosh-gradient px-4 py-3 shadow-lg">
      <div
        className={`flex items-center gap-1.5 mr-3 cursor-pointer rounded-lg px-2 py-1 transition-all ${activeStatus === "All" ? "bg-white/20" : "hover:bg-white/10"}`}
        onClick={() => onStatusFilter?.("All")}
      >
        <span className="text-xs font-bold text-white uppercase tracking-widest">Lifecycle</span>
      </div>
      {steps.map((step, i) => (
        <div key={step.status} className="flex items-center">
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/90 transition-all cursor-pointer ${activeStatus === step.status ? "bg-white/25" : "hover:bg-white/15"}`}
            onClick={() => onStatusFilter?.(step.status)}
          >
            {step.icon}
            <span>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3 w-3 text-white/40 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
};
