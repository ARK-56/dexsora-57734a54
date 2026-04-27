import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";

export interface DbLead {
  id: string;
  patient_name: string;
  dob: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  medicare_id: string;
  ppo_id: string | null;
  dme_items: string | null;
  item: string | null;
  diagnosis: string | null;
  doctor_name: string | null;
  doctor_npi: string | null;
  status: string;
  denial_reason: string | null;
  tracking_number: string | null;
  submitted_by: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  submitted_ip: string | null;
  ship_to: string | null;
  documents: DbLeadDocument[];
}

export interface DbLeadDocument {
  id: string;
  lead_id: string;
  name: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
  is_admin_only: boolean;
}

export const useLeads = () => {
  const { user, hasAdminAccess, profile, roles } = useAuth();
  const { currentOrg, isOrgOwner, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const [leads, setLeads] = useState<DbLead[]>([]);
  const [loading, setLoading] = useState(true);

  const isMarketingRole = roles.includes("logistics");
  // Org owners/admins should see all org leads even if they don't have an admin-access role
  const canSeeAllOrgLeads = hasAdminAccess || isOrgOwner || isOrgAdmin;

  // Fetch user IDs invited by this marketing user
  const fetchInvitedUserIds = useCallback(async (): Promise<string[]> => {
    if (!currentOrg || !user) return [];
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-org-members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "list_invited_user_ids", organizationId: currentOrg.id }),
        }
      );
      const result = await res.json();
      return result.userIds || [];
    } catch {
      return [];
    }
  }, [currentOrg, user]);

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    // Auto-update stale leads & cleanup old trashed leads
    try {
      await supabase.rpc("auto_update_stale_leads");
    } catch (e) {
      // Ignore if function doesn't exist or fails
    }
    try {
      await supabase.rpc("cleanup_old_trashed_leads");
    } catch (e) {
      // Ignore if function doesn't exist or fails
    }

    // If marketing role, only show leads from users they invited
    if (isMarketingRole && !canSeeAllOrgLeads) {
      const invitedIds = await fetchInvitedUserIds();
      if (invitedIds.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }

      let mQuery = supabase
        .from("leads")
        .select("*")
        .is("deleted_at", null)
        .in("submitted_by", invitedIds)
        .order("created_at", { ascending: false });

      if (currentOrg) {
        mQuery = mQuery.eq("organization_id", currentOrg.id);
      }

      const { data: leadsData, error: leadsError } = await mQuery;
      if (leadsError) {
        console.error("Error fetching leads:", leadsError);
        setLoading(false);
        return;
      }

      const { data: docsData } = await supabase.from("lead_documents").select("*");
      const docsMap = new Map<string, DbLeadDocument[]>();
      (docsData || []).forEach((doc) => {
        const existing = docsMap.get(doc.lead_id) || [];
        existing.push(doc);
        docsMap.set(doc.lead_id, existing);
      });

      setLeads((leadsData || []).map((lead) => ({
        ...lead,
        item: (lead as any).item || null,
        diagnosis: (lead as any).diagnosis || null,
        doctor_name: (lead as any).doctor_name || null,
        doctor_npi: (lead as any).doctor_npi || null,
        documents: docsMap.get(lead.id) || [],
      })));
      setLoading(false);
      return;
    }

    let query = supabase
      .from("leads")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Doctors/facility users only see their own leads; org admins/owners & admin roles see all org leads
    if (!canSeeAllOrgLeads && !isMarketingRole) {
      query = query.eq("submitted_by", user.id);
      if (currentOrg) {
        query = query.eq("organization_id", currentOrg.id);
      }
    } else if (currentOrg) {
      query = query.eq("organization_id", currentOrg.id);
    } else if (!canSeeAllOrgLeads) {
      query = query.eq("submitted_by", user.id);
    }

    const { data: leadsData, error: leadsError } = await query;

    if (leadsError) {
      console.error("Error fetching leads:", leadsError);
      return;
    }

    const { data: docsData } = await supabase
      .from("lead_documents")
      .select("*");

    const docsMap = new Map<string, DbLeadDocument[]>();
    (docsData || []).forEach((doc) => {
      const existing = docsMap.get(doc.lead_id) || [];
      existing.push(doc);
      docsMap.set(doc.lead_id, existing);
    });

    const enrichedLeads: DbLead[] = (leadsData || []).map((lead) => ({
      ...lead,
      item: (lead as any).item || null,
      diagnosis: (lead as any).diagnosis || null,
      doctor_name: (lead as any).doctor_name || null,
      doctor_npi: (lead as any).doctor_npi || null,
      documents: docsMap.get(lead.id) || [],
    }));

    setLeads(enrichedLeads);
    setLoading(false);
  }, [user, canSeeAllOrgLeads, currentOrg, isMarketingRole, fetchInvitedUserIds]);

  useEffect(() => {
    if (!user) return;
    fetchLeads();

    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchLeads();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_documents" }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchLeads]);

  const createLead = async (data: {
    patientName: string;
    dob: string;
    phone: string;
    address: string;
    item: string;
    diagnosis: string;
    insurance: string;
    shipTo?: "patient" | "doctor" | "other";
    shipToOther?: string;
    documents: { name: string; url: string }[];
  }) => {
    if (!user) return;

    // Fetch the submitter's real IP via edge function
    let submittedIp: string | null = null;
    try {
      const ipRes = await supabase.functions.invoke("get-client-ip");
      submittedIp = ipRes.data?.ip ?? null;
    } catch {
      // Non-critical — continue without IP
    }

    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        patient_name: data.patientName,
        dob: data.dob,
        phone: data.phone,
        address: data.address,
        medicare_id: "N/A",
        item: data.item,
        diagnosis: data.diagnosis,
        insurance: data.insurance || null,
        ship_to: data.shipTo || "patient",
        doctor_name: profile?.full_name || "Unknown",
        doctor_npi: profile?.npi || "",
        submitted_by: user.id,
        organization_id: currentOrg?.id || null,
        submitted_ip: submittedIp,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (newLead && data.documents.length > 0) {
      const docInserts = data.documents.map((d) => ({
        lead_id: newLead.id,
        name: d.name,
        url: d.url,
        uploaded_by: user.id,
        organization_id: currentOrg?.id || null,
      }));
      await supabase.from("lead_documents").insert(docInserts);
    }

    await fetchLeads();
    toast({ title: "Lead submitted", description: `${data.patientName} has been added.` });
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchLeads();
  };

  const softDeleteLeads = async (leadIds: string[]) => {
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", leadIds);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchLeads();
    toast({ title: "Moved to trash", description: `${leadIds.length} lead(s) moved to trash.` });
  };

  const permanentDeleteLeads = async (leadIds: string[]) => {
    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", leadIds);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchLeads();
    toast({ title: "Permanently deleted", description: `${leadIds.length} lead(s) permanently removed.` });
  };

  const restoreLeads = async (leadIds: string[]) => {
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: null })
      .in("id", leadIds);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchLeads();
    toast({ title: "Restored", description: `${leadIds.length} lead(s) restored.` });
  };

  const fetchTrashedLeads = useCallback(async () => {
    if (!user) return [];

    let query = supabase
      .from("leads")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    // Scope by organization if user has one
    if (currentOrg) {
      query = query.eq("organization_id", currentOrg.id);
    } else if (!canSeeAllOrgLeads) {
      query = query.eq("submitted_by", user.id);
    }

    const { data: leadsData } = await query;

    const { data: docsData } = await supabase.from("lead_documents").select("*");

    const docsMap = new Map<string, DbLeadDocument[]>();
    (docsData || []).forEach((doc) => {
      const existing = docsMap.get(doc.lead_id) || [];
      existing.push(doc);
      docsMap.set(doc.lead_id, existing);
    });

    return (leadsData || []).map((lead) => ({
      ...lead,
      item: (lead as any).item || null,
      diagnosis: (lead as any).diagnosis || null,
      doctor_name: (lead as any).doctor_name || null,
      doctor_npi: (lead as any).doctor_npi || null,
      documents: docsMap.get(lead.id) || [],
    })) as DbLead[];
  }, [user, canSeeAllOrgLeads, currentOrg]);

  return { leads, loading, createLead, updateLeadStatus, softDeleteLeads, permanentDeleteLeads, restoreLeads, fetchTrashedLeads, refreshLeads: fetchLeads };
};
