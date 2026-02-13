import { LeadStatus } from "@/types/lead";
import { ArrowRight, Hexagon } from "lucide-react";

const steps: { status: LeadStatus; label: string; icon: string }[] = [
  { status: "New Lead", label: "New Lead", icon: "🆕" },
  { status: "Pending", label: "Pending", icon: "⏳" },
  { status: "Eligible", label: "Eligible", icon: "✅" },
  { status: "Shipped", label: "Shipped", icon: "📦" },
  { status: "Delivered", label: "Delivered", icon: "🏠" },
  { status: "Auth Applied", label: "Auth Applied", icon: "📄" },
  { status: "Billed", label: "Billed", icon: "💰" },
  { status: "Paid", label: "Paid", icon: "✅" },
];

export const LifecycleBar = () => {
  return (
    <div className="hidden lg:flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
      <div className="flex items-center gap-1.5 mr-2">
        <Hexagon className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Lead Lifecycle</span>
      </div>
      {steps.map((step, i) => (
        <div key={step.status} className="flex items-center">
          <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground/70 hover:bg-primary/10 transition-colors cursor-default">
            <span className="text-sm">{step.icon}</span>
            <span>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3 w-3 text-primary/40 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
};
