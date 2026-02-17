import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import PendingSetupGuard from "@/components/PendingSetupGuard";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Pricing from "./pages/Pricing";
import Onboarding from "./pages/Onboarding";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import Trash from "./pages/Trash";
import SetupAccount from "./pages/SetupAccount";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <PendingSetupGuard>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/checkout-success" element={<CheckoutSuccess />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/setup-account" element={<SetupAccount />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PendingSetupGuard>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
