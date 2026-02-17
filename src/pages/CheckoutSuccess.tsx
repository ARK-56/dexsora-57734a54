import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Give webhook a few seconds to process
    const timer = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,hsl(183,60%,20%)_0%,hsl(183,100%,25%)_40%,hsl(175,50%,30%)_100%)] p-4">
      <div className="w-full max-w-md animate-fade-in text-center">
        <img alt="Dexsora" className="mx-auto h-16 mb-8" src="/lovable-uploads/9a9a6f34-256f-4cf9-a1a2-5b4b3ca9467f.png" />

        <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-8 shadow-xl">
          {!ready ? (
            <div className="space-y-4">
              <Loader2 className="mx-auto h-12 w-12 text-white animate-spin" />
              <h2 className="text-xl font-bold text-white">Setting up your organization...</h2>
              <p className="text-sm text-white/60">This will only take a moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <CheckCircle className="mx-auto h-14 w-14 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">You're all set!</h2>
              <p className="text-sm text-white/60">
                Your subscription is active and your organization has been created.
              </p>
              <Button
                onClick={() => navigate("/")}
                className="mt-4 h-11 w-full rounded-xl bg-white text-sm font-semibold text-[hsl(183,100%,25%)] hover:bg-white/90"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
