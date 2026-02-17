import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const PendingSetupGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // If user has pending_setup and is NOT already on /setup-account, force redirect
  if (
    user &&
    user.user_metadata?.pending_setup === true &&
    location.pathname !== "/setup-account"
  ) {
    return <Navigate to="/setup-account" replace />;
  }

  return <>{children}</>;
};

export default PendingSetupGuard;
