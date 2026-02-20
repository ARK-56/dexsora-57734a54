import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Organization {
  id: string;
  name: string;
  plan_type: string;
  is_active: boolean;
  owner_id: string;
  created_at: string;
}

interface OrgContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrgId: (id: string) => void;
  loading: boolean;
  isOrgOwner: boolean;
  isOrgAdmin: boolean;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be inside OrgProvider");
  return ctx;
};

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setOrganizations([]);
      setCurrentOrgId(null);
      setLoading(false);
      return;
    }

    // Fetch orgs where user is owner
    const { data: ownedOrgs } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .eq("is_active", true);

    // Fetch orgs where user is a member
    const { data: memberships } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id);

    const memberOrgIds = (memberships || []).map((m) => m.organization_id);

    let memberOrgs: Organization[] = [];
    if (memberOrgIds.length > 0) {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .in("id", memberOrgIds)
        .eq("is_active", true);
      memberOrgs = (data || []) as Organization[];
    }

    // Merge and deduplicate
    const allOrgs = [...(ownedOrgs || []), ...memberOrgs] as Organization[];
    const uniqueOrgs = Array.from(new Map(allOrgs.map((o) => [o.id, o])).values());

    setOrganizations(uniqueOrgs);

    // Restore saved org or pick first
    if (uniqueOrgs.length > 0) {
      const savedOrgId = localStorage.getItem(`dexsora_org_${user.id}`);
      const validSaved = savedOrgId && uniqueOrgs.some((o) => o.id === savedOrgId);
      setCurrentOrgId(validSaved ? savedOrgId : uniqueOrgs[0].id);
    } else {
      setCurrentOrgId(null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleSetCurrentOrgId = (id: string) => {
    setCurrentOrgId(id);
    if (user) {
      localStorage.setItem(`dexsora_org_${user.id}`, id);
    }
  };

  const currentOrg = organizations.find((o) => o.id === currentOrgId) || null;
  const isOrgOwner = !!(currentOrg && user && currentOrg.owner_id === user.id);
  const isOrgAdmin = isOrgOwner; // Owner is always admin; could be extended with org_members role check

  return (
    <OrgContext.Provider
      value={{
        organizations,
        currentOrg,
        setCurrentOrgId: handleSetCurrentOrgId,
        loading,
        isOrgOwner,
        isOrgAdmin,
        refreshOrgs: fetchOrgs,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};
