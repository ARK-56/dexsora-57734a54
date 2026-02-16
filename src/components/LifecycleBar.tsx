import { LeadStatus } from "@/types/lead";
import { ArrowRight, Sparkles, Clock, CheckCircle2, Package, Home, FileCheck, Receipt, DollarSign } from "lucide-react";

const steps: { status: LeadStatus; label: string; icon: React.ReactNode }[] = [
  { status: "New Lead", label: "New Lead", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { status: "Pending", label: "Pending", icon: <Clock className="h-3.5 w-3.5" /> },
  { status: "Eligible", label: "Eligible", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { status: "Shipped", label: "Shipped", icon: <Package className="h-3.5 w-3.5" /> },
  { status: "Delivered", label: "Delivered", icon: <Home className="h-3.5 w-3.5" /> },
  { status: "Auth Applied", label: "Auth Applied", icon: <FileCheck className="h-3.5 w-3.5" /> },
  { status: "Billed", label: "Billed", icon: <Receipt className="h-3.5 w-3.5" /> },
  { status: "Paid", label: "Paid", icon: <DollarSign className="h-3.5 w-3.5" /> },
];

export const LifecycleBar = () => {
  return (
    <div className="hidden lg:flex items-center gap-0.5 rounded-xl swoosh-gradient px-4 py-3 shadow-lg">
      <div className="flex items-center gap-1.5 mr-3">
        <span className="text-xs font-bold text-white uppercase tracking-widest">Lifecycle</span>
      </div>
      {steps.map((step, i) => (
        <div key={step.status} className="flex items-center">
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15 transition-all cursor-default">
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
