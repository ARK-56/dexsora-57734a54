import { LeadStatus } from "@/types/lead";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const steps: { status: LeadStatus; label: string; icon: string }[] = [
  { status: "Pending", label: "Pending", icon: "📋" },
  { status: "Open", label: "Open (SNS)", icon: "🔍" },
  { status: "Auth", label: "Auth", icon: "📄" },
  { status: "Approved", label: "Approved", icon: "✅" },
  { status: "Delivered", label: "Delivered", icon: "📦" },
  { status: "Closed", label: "Closed", icon: "📁" },
];

export const LifecycleBar = () => {
  return (
    <div className="hidden lg:flex items-center gap-1 rounded-lg border border-border bg-card px-4 py-2.5">
      <span className="text-xs font-semibold text-muted-foreground mr-2 uppercase tracking-wider">Lifecycle</span>
      {steps.map((step, i) => (
        <div key={step.status} className="flex items-center">
          <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-default">
            <span className="text-sm">{step.icon}</span>
            <span>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3 w-3 text-border mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
};
