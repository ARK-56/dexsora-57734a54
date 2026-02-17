import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Single Organization",
    description: "Perfect for a single practice or clinic",
    monthlyPrice: 100,
    yearlyPrice: 1200,
    monthlyKey: "single_monthly",
    yearlyKey: "single_yearly",
    features: [
      "1 Organization",
      "Unlimited admin users",
      "Unlimited doctors",
      "Full lead management",
      "Document storage",
      "Team chat",
      "Audit logging",
    ],
  },
  {
    name: "Multi Organization",
    description: "For networks managing multiple practices",
    monthlyPrice: 500,
    yearlyPrice: 6000,
    monthlyKey: "multi_monthly",
    yearlyKey: "multi_yearly",
    popular: true,
    features: [
      "Up to 5 Organizations",
      "Separate panels per org",
      "Unlimited admin users per org",
      "Unlimited doctors per org",
      "Full lead management",
      "Document storage",
      "Team chat",
      "Audit logging",
      "Priority support",
    ],
  },
];

const Pricing = () => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSelectPlan = (plan: typeof PLANS[0]) => {
    const priceKey = billing === "monthly" ? plan.monthlyKey : plan.yearlyKey;
    if (user) {
      navigate(`/onboarding?plan=${priceKey}`);
    } else {
      navigate(`/signup?plan=${priceKey}`);
    }
  };

  // Also allow direct access without choosing a plan
  const handleFreeTrial = () => {
    if (user) {
      navigate("/onboarding");
    } else {
      navigate("/signup");
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <img
          alt="Dexsora"
          className="h-10"
          src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png"
        />
        <div className="flex items-center gap-3">
          {user ? (
            <Button
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/")}
            >
              Dashboard
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-6 pt-12 pb-8 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-white/70">
          Choose the plan that fits your practice. No hidden fees, cancel anytime.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur-sm">
          <button
            onClick={() => setBilling("monthly")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              billing === "monthly"
                ? "bg-white text-[hsl(183,100%,25%)] shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              billing === "yearly"
                ? "bg-white text-[hsl(183,100%,25%)] shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
          >
            Yearly <span className="text-xs opacity-75">Save 2 months</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 backdrop-blur-lg transition-all ${
                plan.popular
                  ? "border-white/30 bg-white/15 shadow-2xl scale-[1.02]"
                  : "border-white/10 bg-white/10"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-xs font-bold text-[hsl(183,100%,25%)]">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-white/60">{plan.description}</p>

              <div className="mt-6">
                <span className="text-4xl font-extrabold text-white">
                  ${billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                </span>
                <span className="text-white/60 text-sm">
                  /{billing === "monthly" ? "mo" : "yr"}
                </span>
                {billing === "yearly" && (
                  <p className="mt-1 text-xs text-emerald-300">
                    ${Math.round(plan.yearlyPrice / 12)}/mo billed annually
                  </p>
                )}
              </div>

              <Button
                onClick={() => handleSelectPlan(plan)}
                className={`mt-6 w-full h-11 rounded-xl font-semibold text-sm ${
                  plan.popular
                    ? "bg-white text-[hsl(183,100%,25%)] hover:bg-white/90"
                    : "bg-white/20 text-white hover:bg-white/30 border border-white/20"
                }`}
              >
                Get Started
              </Button>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-white/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
