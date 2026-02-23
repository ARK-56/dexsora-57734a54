import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Users, Shield, Bell, ArrowLeft, UserPlus, X, Pencil, FileText, Stethoscope, MessageSquare, MessageCircle, Trash2, Search, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLeads, DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadStatus } from "@/types/lead";
import { Textarea } from "@/components/ui/textarea";
import { PatientDrawer } from "@/components/PatientDrawer";
import { AdminChat } from "@/components/AdminChat";
import { PrescriptionPanel } from "@/components/PrescriptionPanel";
import { useOrg } from "@/contexts/OrgContext";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  npi: string | null;
  created_at: string;
}

interface RoleRow {
  user_id: string;
  role: string;
}

const STAFF_ROLE_OPTIONS = ["admin", "eligibility", "shipment", "billing"] as const;
const ALL_ROLE_OPTIONS = ["admin", "doctor", "eligibility", "shipment", "billing"] as const;

const ROLE_LABELS: Record<string, string> = {
  doctor: "Doctor/Facility",
  eligibility: "Eligibility and Auth Department",
  auth_team: "Eligibility and Auth Department",
  billing: "Billing Department",
  shipment: "Shipment Department",
  logistics: "Marketing Department",
  admin: "Admin",
  super_admin: "Super Admin",
};

const formatRole = (role: string) => ROLE_LABELS[role] ?? role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const ALL_STATUSES: LeadStatus[] = [
  "New Lead", "Pending", "Need Additional Documents", "Eligible", "Shipped", "Delivered",
  "Need To Bill", "Billed", "PrePay Audit", "Appeal", "Paid", "Denied", "PostPay Audit", "Not Eligible",
];

const STATUS_LABELS: Record<string, string> = {
  "New Lead": "New Patient",
  "Pending": "Pending",
  "Need Additional Documents": "Need Additional Documents",
  "Eligible": "Eligible",
  "Shipped": "Shipped",
  "Delivered": "Delivered",
  "Need To Bill": "Need To Bill Cases",
  "Billed": "Billed Cases",
  "PrePay Audit": "PrePay Audit Cases",
  "Appeal": "Appeal Cases",
  "Paid": "Paid Cases",
  "Denied": "Denied Cases",
  "PostPay Audit": "PostPay Audit Cases",
  "Not Eligible": "Not Eligible",
};

const getAvailableStatuses = (currentStatus: string, roles: string[], isOrgOwnerOrAdmin: boolean): LeadStatus[] => {
  const isAdmin = roles.includes("admin") || isOrgOwnerOrAdmin;
  if (isAdmin) return ALL_STATUSES;

  const isEligibility = roles.includes("eligibility");
  const isShipment = roles.includes("shipment");
  const isBilling = roles.includes("billing");

  if (isEligibility && (currentStatus === "New Lead" || currentStatus === "Pending")) {
    return ["Eligible", "Not Eligible", "Need Additional Documents"];
  }
  if (isShipment && (currentStatus === "Eligible" || currentStatus === "Need Additional Documents")) {
    return ["Shipped", "Delivered"];
  }
  if (isBilling && (currentStatus === "Shipped" || currentStatus === "Delivered")) {
    return ["Auth Applied", "Billed", "Paid", "Denied"];
  }
  return [];
};

const AdminPanel = () => {
  const { hasAdminAccess, isAdmin, loading, roles, profile, user, isSuperAdmin, isDoctor } = useAuth();
  const { isOrgOwner, isOrgAdmin, currentOrg } = useOrg();
  const { toast } = useToast();
  const { leads, loading: leadsLoading, updateLeadStatus } = useLeads();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userRoles, setUserRoles] = useState<RoleRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", role: "eligibility" as string });
  const [doctorForm, setDoctorForm] = useState({ email: "", npi: "" });
  const [adding, setAdding] = useState(false);
  const [editUser, setEditUser] = useState<ProfileRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", role: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "leads" | "chat">("leads");
  const [leadsSubTab, setLeadsSubTab] = useState<"all" | "eligibility" | "needadditionaldocs" | "eligible" | "shipment" | "delivered" | "denied" | "billed" | "needtobill" | "prepayaudit" | "appeal" | "paid" | "postpayaudit" | "noteligible">("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [noteModal, setNoteModal] = useState<{ leadId: string; patientName: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DbLead | null>(null);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<ProfileRow | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  const fetchUnreadNotes = async () => {
    const { count } = await supabase
      .from("lead_notes")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .eq("is_internal", false);
    setUnreadNotesCount(count || 0);
  };

  // Track new leads count
  useEffect(() => {
    const count = leads.filter((l) => l.status === "New Lead").length;
    setNewLeadsCount(count);
  }, [leads]);

  // Reset new leads count when leads tab is opened
  useEffect(() => {
    if (activeTab === "leads") {
      setNewLeadsCount(0);
    }
  }, [activeTab]);

  const fetchData = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, npi, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    if (rolesRes.data) setUserRoles(rolesRes.data);
    setLoadingData(false);
  };

  useEffect(() => {
    if (!hasAdminAccess) return;
    fetchData();
    fetchUnreadNotes();
    const ch = supabase
      .channel("admin-notes-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_notes" }, () => fetchUnreadNotes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hasAdminAccess]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user?.user_metadata?.pending_setup) return <Navigate to="/setup-account" replace />;
  if (isSuperAdmin) return <Navigate to="/super-admin" replace />;
  if (!hasAdminAccess && !isOrgOwner && !isOrgAdmin) return <Navigate to="/" replace />;

  const getUserRoles = (userId: string) =>
    userRoles.filter((r) => r.user_id === userId).map((r) => r.role);

  const callManageUsers = async (body: any) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Request failed");
    return result;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await callManageUsers({
        action: "invite_user",
        email: addForm.email.trim(),
        role: addForm.role,
      });
      toast({ title: "Invitation sent", description: `An invitation has been sent to ${addForm.email}.` });
      setAddForm({ email: "", role: "eligibility" });
      setShowAddUser(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setAdding(false);
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (doctorForm.npi && !/^\d{10}$/.test(doctorForm.npi)) {
      toast({ title: "Validation Error", description: "NPI must be exactly 10 digits.", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await callManageUsers({
        action: "invite_doctor",
        email: doctorForm.email.trim(),
        npi: doctorForm.npi.trim(),
      });
      toast({ title: "Invitation sent", description: `An invitation has been sent to ${doctorForm.email}.` });
      setDoctorForm({ email: "", npi: "" });
      setShowAddDoctor(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setAdding(false);
  };

  const openEditUser = (p: ProfileRow) => {
    const ur = getUserRoles(p.user_id);
    setEditUser(p);
    setEditForm({ fullName: p.full_name || "", email: p.email || "", role: ur[0] || "", password: "" });
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    if (editForm.password && editForm.password.length < 8) {
      toast({ title: "Validation Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        action: "update",
        userId: editUser.user_id,
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      await callManageUsers(payload);
      toast({ title: "User updated", description: "Changes saved." });
      setEditUser(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    setDeletingUserId(confirmDeleteUser.user_id);
    try {
      await callManageUsers({ action: "delete_user", userId: confirmDeleteUser.user_id });
      toast({ title: "User deleted", description: `${confirmDeleteUser.full_name || confirmDeleteUser.email} has been removed.` });
      setConfirmDeleteUser(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDeletingUserId(null);
  };

  const handleResendInvite = async (userId: string, email: string) => {
    setResendingInvite(userId);
    try {
      await callManageUsers({ action: "resend_invite", userId });
      toast({ title: "Invitation resent", description: `A new invitation has been sent to ${email}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setResendingInvite(null);
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    // If status is "Need Additional Documents", open note modal
    if (newStatus === "Need Additional Documents") {
      const lead = leads.find(l => l.id === leadId);
      setNoteModal({ leadId, patientName: lead?.patient_name || "" });
      // Still update the status
    }
    await updateLeadStatus(leadId, newStatus);
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedLeadIds.length === 0) return;
    await Promise.all(selectedLeadIds.map((id) => updateLeadStatus(id, bulkStatus)));
    toast({ title: "Bulk update complete", description: `${selectedLeadIds.length} lead(s) updated to "${bulkStatus}".` });
    setSelectedLeadIds([]);
    setBulkStatus("");
  };

  const handleAddNote = async () => {
    if (!noteModal || !noteText.trim()) return;
    setAddingNote(true);
    const orgId = currentOrg?.id ?? null;
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: noteModal.leadId,
      text: noteText.trim(),
      author: profile?.full_name || "Admin",
      is_internal: false,
      organization_id: orgId,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Note added", description: "Note has been added to the lead." });
    }
    setNoteText("");
    setNoteModal(null);
    setAddingNote(false);
  };

  const availableStatusesForRole = (currentStatus: string) => getAvailableStatuses(currentStatus, roles, isOrgOwner || isOrgAdmin);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onNotificationClick={(patientName) => {
          const lead = leads.find((l) => l.patient_name === patientName);
          if (lead) {
            setActiveTab("leads");
            setSelectedLead(lead);
          }
        }}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Manage users, roles, and leads</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrescriptionOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <FileText className="h-4 w-4" />
              Prescriptions
            </button>
            {isAdmin && activeTab === "users" && (
              <>
                <button
                  onClick={() => setShowAddDoctor(true)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <Stethoscope className="h-4 w-4" />
                  Add Doctor
                </button>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4" />
                  Add User
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats - only for admin */}
        {isAdmin && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl swoosh-gradient p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-white">{leads.length}</p>
                <p className="text-xs text-white/80">Total Leads</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl swoosh-gradient p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-white">
                  {userRoles.filter((r) => r.role === "doctor").length}
                </p>
                <p className="text-xs text-white/80">Total Doctors</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl swoosh-gradient p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-white">
                  {userRoles.filter((r) => r.role === "admin").length}
                </p>
                <p className="text-xs text-white/80">Admins</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl swoosh-gradient p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-white">
                  {userRoles.filter((r) => ["eligibility", "auth_team", "shipment", "billing"].includes(r.role)).map(r => r.user_id).filter((v, i, a) => a.indexOf(v) === i).length}
                </p>
                <p className="text-xs text-white/80">Users with Admin Access</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("leads")}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "leads" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Leads ({leads.length})
            {activeTab !== "leads" && newLeadsCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {newLeadsCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Users ({profiles.length})
            </button>
          )}
          {/* Chat tab hidden */}
        </div>

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            {/* Left: All Leads table */}
            <div className="space-y-4 min-w-0">
              {/* Bulk action bar */}
              {selectedLeadIds.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
                  <span className="text-sm font-semibold text-foreground">{selectedLeadIds.length} selected</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value="">Set status...</option>
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkStatusUpdate}
                      disabled={!bulkStatus}
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => { setSelectedLeadIds([]); setBulkStatus(""); }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
                      title="Clear selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                  </div>
                ) : (() => {
                  const filteredLeads = leadsSubTab === "all" ? leads.filter(l => l.status === "New Lead")
                    : leadsSubTab === "eligibility" ? leads.filter(l => l.status === "Pending")
                    : leadsSubTab === "needadditionaldocs" ? leads.filter(l => l.status === "Need Additional Documents")
                    : leadsSubTab === "eligible" ? leads.filter(l => l.status === "Eligible")
                    : leadsSubTab === "shipment" ? leads.filter(l => l.status === "Shipped")
                    : leadsSubTab === "delivered" ? leads.filter(l => l.status === "Delivered")
                    : leadsSubTab === "needtobill" ? leads.filter(l => l.status === "Need To Bill")
                    : leadsSubTab === "prepayaudit" ? leads.filter(l => l.status === "PrePay Audit")
                    : leadsSubTab === "appeal" ? leads.filter(l => l.status === "Appeal")
                    : leadsSubTab === "paid" ? leads.filter(l => l.status === "Paid")
                    : leadsSubTab === "denied" ? leads.filter(l => l.status === "Denied")
                    : leadsSubTab === "postpayaudit" ? leads.filter(l => l.status === "PostPay Audit")
                    : leadsSubTab === "noteligible" ? leads.filter(l => l.status === "Not Eligible")
                    : leads.filter(l => l.status === "Billed");

                  const allChecked = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l.id));

                  return filteredLeads.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">No leads in this category.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="swoosh-gradient">
                            <th className="w-10 px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary rounded"
                                checked={allChecked}
                                onChange={() => {
                                  if (allChecked) {
                                    setSelectedLeadIds(prev => prev.filter(id => !filteredLeads.some(l => l.id === id)));
                                  } else {
                                    setSelectedLeadIds(prev => [...new Set([...prev, ...filteredLeads.map(l => l.id)])]);
                                  }
                                }}
                              />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Patient</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Doctor</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Item</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Docs</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Order Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.map((lead, idx) => {
                            const availStatuses = availableStatusesForRole(lead.status);
                            const isChecked = selectedLeadIds.includes(lead.id);
                            return (
                              <tr
                                key={lead.id}
                                className={`border-b border-border transition-colors hover:bg-muted/30 ${idx % 2 === 1 ? "bg-muted/10" : ""} ${isChecked ? "!bg-primary/10 ring-1 ring-inset ring-primary/20" : ""}`}
                              >
                                <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-primary rounded"
                                    checked={isChecked}
                                    onChange={() => setSelectedLeadIds(prev =>
                                      prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id]
                                    )}
                                  />
                                </td>
                                <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                                  <p className="text-sm font-semibold text-primary hover:underline">{lead.patient_name}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm font-medium text-foreground">{lead.doctor_name || "—"}</p>
                                  {lead.doctor_npi && <p className="text-xs text-muted-foreground">NPI: {lead.doctor_npi}</p>}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={lead.status as LeadStatus} />
                                </td>
                                <td className="px-4 py-3 text-sm text-foreground">{lead.item || lead.dme_items || "—"}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {lead.documents.length > 0 ? `${lead.documents.length} file(s)` : "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {availStatuses.length > 0 ? (
                                      <select
                                        value={lead.status}
                                        onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
                                      >
                                        <option value={lead.status}>{STATUS_LABELS[lead.status] ?? lead.status}</option>
                                        {availStatuses.filter(s => s !== lead.status).map((s) => (
                                          <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">No actions</span>
                                    )}
                                    {lead.status === "Need Additional Documents" && (
                                      <button
                                        onClick={() => setNoteModal({ leadId: lead.id, patientName: lead.patient_name })}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                                        title="Add note"
                                      >
                                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>


            {/* Right: Case category tabs */}
            <div className="hidden lg:block">
              <div className="sticky top-6">
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                  <div className="swoosh-gradient px-4 py-2.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/80">Filter by Status</h3>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {([
                      { key: "all" as const, label: "New Patient", count: leads.filter(l => l.status === "New Lead").length },
                      { key: "eligibility" as const, label: "Pending", count: leads.filter(l => l.status === "Pending").length },
                      { key: "needadditionaldocs" as const, label: "Need Additional Documents", count: leads.filter(l => l.status === "Need Additional Documents").length },
                      { key: "eligible" as const, label: "Eligible", count: leads.filter(l => l.status === "Eligible").length },
                      { key: "shipment" as const, label: "Shipped", count: leads.filter(l => l.status === "Shipped").length },
                      { key: "delivered" as const, label: "Delivered", count: leads.filter(l => l.status === "Delivered").length },
                      { key: "needtobill" as const, label: "Need To Bill Cases", count: leads.filter(l => l.status === "Need To Bill").length },
                      { key: "billed" as const, label: "Billed Cases", count: leads.filter(l => l.status === "Billed").length },
                      { key: "prepayaudit" as const, label: "PrePay Audit Cases", count: leads.filter(l => l.status === "PrePay Audit").length },
                      { key: "appeal" as const, label: "Appeal Cases", count: leads.filter(l => l.status === "Appeal").length },
                      { key: "paid" as const, label: "Paid Cases", count: leads.filter(l => l.status === "Paid").length },
                      { key: "denied" as const, label: "Denied Cases", count: leads.filter(l => l.status === "Denied").length },
                      { key: "postpayaudit" as const, label: "PostPay Audit Cases", count: leads.filter(l => l.status === "PostPay Audit").length },
                      { key: "noteligible" as const, label: "Not Eligible", count: leads.filter(l => l.status === "Not Eligible").length },
                    ]).map((tab) => {
                      const isActive = leadsSubTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setLeadsSubTab(tab.key)}
                          className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-all ${
                            isActive ? "bg-primary/10 font-semibold text-foreground" : "text-foreground/70 hover:bg-muted font-medium"
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <div className={`h-2 w-2 rounded-full ${isActive ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : "bg-muted-foreground/25"}`} />
                            {tab.label}
                          </span>
                          <span className={`min-w-[22px] text-center text-xs font-bold rounded-full px-1.5 py-0.5 ${
                            isActive ? "bg-primary/15 text-primary" : tab.count > 0 ? "bg-muted text-muted-foreground" : "text-muted-foreground/40"
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (() => {
          const searchLower = userSearch.toLowerCase();
          const filteredProfiles = profiles.filter((p) => {
            if (!userSearch) return true;
            return (
              (p.full_name || "").toLowerCase().includes(searchLower) ||
              (p.email || "").toLowerCase().includes(searchLower) ||
              getUserRoles(p.user_id).some((r) => r.toLowerCase().includes(searchLower))
            );
          });
          const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / USERS_PER_PAGE));
          const currentPage = Math.min(userPage, totalPages);
          const paginatedProfiles = filteredProfiles.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

          return (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  placeholder="Search users..."
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {loadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                  </div>
                ) : paginatedProfiles.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No users found.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="swoosh-gradient">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">User</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Roles</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">NPI</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Joined</th>
                        {isAdmin && <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/90">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedProfiles.map((p) => (
                        <tr key={p.user_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-foreground">{p.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {getUserRoles(p.user_id).length > 0 ? (
                                getUserRoles(p.user_id).map((role) => (
                                  <span key={role} className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                                    {formatRole(role)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No roles</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">
                            {p.npi || "—"}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          {isAdmin && (
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Show resend invite for users whose name equals their email (pending setup) */}
                                {p.full_name === p.email && (
                                  <button
                                    onClick={() => handleResendInvite(p.user_id, p.email || "")}
                                    disabled={resendingInvite === p.user_id}
                                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                    title="Resend invitation"
                                  >
                                    <Send className="h-3 w-3" />
                                    {resendingInvite === p.user_id ? "Sending..." : "Resend"}
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditUser(p)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                                  title="Edit user"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteUser(p)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * USERS_PER_PAGE + 1}–{Math.min(currentPage * USERS_PER_PAGE, filteredProfiles.length)} of {filteredProfiles.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        onClick={() => setUserPage(pg)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          pg === currentPage ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"
                        }`}
                      >
                        {pg}
                      </button>
                    ))}
                    <button
                      onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Chat Tab */}
        {activeTab === "chat" && <AdminChat />}
      </main>

      {/* Add User Modal (Staff roles only) */}
      {showAddUser && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowAddUser(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">Invite Staff User</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">An invitation link will be sent to set up their account</p>
                </div>
                <button onClick={() => setShowAddUser(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                  <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="user@company.com" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                  <select value={addForm.role} onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring">
                    {STAFF_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{formatRole(r)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddUser(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">Cancel</button>
                  <button type="submit" disabled={adding} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
                    {adding ? "Sending..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Add Doctor Modal */}
      {showAddDoctor && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowAddDoctor(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">Invite Doctor</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">An invitation link will be sent to set up their account</p>
                </div>
                <button onClick={() => setShowAddDoctor(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleAddDoctor} className="p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                  <input type="email" value={doctorForm.email} onChange={(e) => setDoctorForm((p) => ({ ...p, email: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="doctor@clinic.com" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">NPI (Optional)</label>
                  <input type="text" value={doctorForm.npi} onChange={(e) => setDoctorForm((p) => ({ ...p, npi: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="1234567890" pattern="\d{10}" title="NPI must be exactly 10 digits" maxLength={10} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddDoctor(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">Cancel</button>
                  <button type="submit" disabled={adding} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
                    {adding ? "Sending..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="font-display text-lg font-bold text-foreground">Edit User</h2>
                <button onClick={() => setEditUser(null)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleEditUser} className="p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full Name</label>
                  <input type="text" value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                  <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring">
                    {ALL_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{formatRole(r)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">New Password (leave blank to keep current)</label>
                  <input type="password" value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="••••••••" minLength={8} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditUser(null)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">Cancel</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Add Note Modal */}
      {noteModal && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setNoteModal(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">Add Note</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">For {noteModal.patientName}</p>
                </div>
                <button onClick={() => setNoteModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter note about additional documents needed..."
                  className="min-h-[120px]"
                />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setNoteModal(null)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">Cancel</button>
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteText.trim()}
                    className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {addingNote ? "Adding..." : "Add Note"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <PatientDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        currentRole={roles[0] as any || "admin"}
        canUpdateStatus={true}
        onUpdateStatus={(id, status) => {
          handleUpdateLeadStatus(id, status);
          setSelectedLead(null);
        }}
      />
      <PrescriptionPanel open={prescriptionOpen} onClose={() => setPrescriptionOpen(false)} />

      {/* Delete User Confirmation */}
      {confirmDeleteUser && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setConfirmDeleteUser(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="p-6 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-center">
                  <h3 className="font-display text-lg font-bold text-foreground">Delete User</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDeleteUser.full_name || confirmDeleteUser.email}</span>? This action cannot be undone.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setConfirmDeleteUser(null)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">Cancel</button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={deletingUserId === confirmDeleteUser.user_id}
                    className="rounded-lg bg-destructive px-6 py-2.5 text-sm font-semibold text-destructive-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {deletingUserId === confirmDeleteUser.user_id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPanel;
