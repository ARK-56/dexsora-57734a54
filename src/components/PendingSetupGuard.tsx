import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { Navigate, useLocation } from "react-router-dom";

// Routes that don't require a plan/org to be set up
const PUBLIC_ROUTES = ["/login", "/signup", "/pricing", "/onboarding", "/setup-account", "/checkout-success"];

const PendingSetupGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading } = useOrg();
  const location = useLocation();

  // Wait for both auth and org data to finish loading before making redirect decisions
  if (authLoading || orgLoading) return null;

  // If user has pending_setup and is NOT already on /setup-account, force redirect
  if (
    user &&
    user.user_metadata?.pending_setup === true &&
    location.pathname !== "/setup-account"
  ) {
    return <Navigate to="/setup-account" replace />;
  }

  const isPublicRoute = PUBLIC_ROUTES.some((r) => location.pathname.startsWith(r));

  // If user is logged in, has no org yet, and is not on a public/exempt route,
  // redirect to pricing so they can pick a plan first (new user flow).
  // Only redirect from non-public routes to avoid loops.
  if (
    user &&
    !user.user_metadata?.pending_setup &&
    organizations.length === 0 &&
    !isPublicRoute
  ) {
    return <Navigate to="/pricing" replace />;
  }

  // If user already has an org and tries to visit /onboarding or /pricing, send them home
  if (
    user &&
    organizations.length > 0 &&
    (location.pathname.startsWith("/onboarding") || location.pathname.startsWith("/pricing"))
  ) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default PendingSetupGuard;

