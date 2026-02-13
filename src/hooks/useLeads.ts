import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  status: string;
  denial_reason: string | null;
  tracking_number: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  documents: DbLeadDocument[];
}

export interface DbLeadDocument {
  id: string;
  lead_id: string;
  name: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

export const useLeads = () => {
  const { user, hasAdminAccess } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<DbLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    let query = supabase
      .from("leads")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Non-admin users only see their own leads
    if (!hasAdminAccess) {
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
      documents: docsMap.get(lead.id) || [],
    }));

    setLeads(enrichedLeads);
    setLoading(false);
  }, [user, hasAdminAccess]);

  useEffect(() => {
    if (!user) return;
    fetchLeads();

    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
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
    email: string;
    address: string;
    medicareId: string;
    ppoId: string;
    dmeItems: string;
    documents: { name: string; url: string }[];
  }) => {
    if (!user) return;

    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        patient_name: data.patientName,
        dob: data.dob,
        phone: data.phone,
        email: data.email,
        address: data.address,
        medicare_id: data.medicareId,
        ppo_id: data.ppoId,
        dme_items: data.dmeItems,
        submitted_by: user.id,
      })
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

    // Non-admin users only see their own trashed leads
    if (!hasAdminAccess) {
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
      documents: docsMap.get(lead.id) || [],
    })) as DbLead[];
  }, [user, hasAdminAccess]);

  return { leads, loading, createLead, updateLeadStatus, softDeleteLeads, permanentDeleteLeads, restoreLeads, fetchTrashedLeads, refreshLeads: fetchLeads };
};
