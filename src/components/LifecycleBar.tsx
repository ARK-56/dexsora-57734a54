import { LeadStatus } from "@/types/lead";
import { cn } from "@/lib/utils";

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
    <div className="hidden lg:flex items-center justify-between rounded-xl border border-border bg-card p-3 px-6">
      {steps.map((step, i) => (
        <div key={step.status} className="flex items-center">
          <div className="flex items-center gap-2">
            <span className="text-base">{step.icon}</span>
            <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className="mx-4 h-px w-8 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
};
