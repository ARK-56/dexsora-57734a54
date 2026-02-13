import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Users, Shield, Bell, ArrowLeft, UserPlus, X, Pencil, FileText, Stethoscope, MessageSquare, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLeads, DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadStatus } from "@/types/lead";
import { Textarea } from "@/components/ui/textarea";
import { PatientDrawer } from "@/components/PatientDrawer";
import { AdminChat } from "@/components/AdminChat";

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

const STAFF_ROLE_OPTIONS = ["eligibility", "shipment", "billing"] as const;
const ALL_ROLE_OPTIONS = ["admin", "doctor", "eligibility", "shipment", "billing"] as const;

const formatRole = (role: string) =>
  role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const ALL_STATUSES: LeadStatus[] = [
  "New Lead", "Pending", "Eligible", "Not Eligible", "Need Additional Documents",
  "Shipped", "Delivered", "Auth Applied", "Billed", "Paid", "Denied",
];

const getAvailableStatuses = (currentStatus: string, roles: string[]): LeadStatus[] => {
  const isAdmin = roles.includes("admin");
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
  const { hasAdminAccess, isAdmin, loading, roles, profile } = useAuth();
  const { toast } = useToast();
  const { leads, loading: leadsLoading, updateLeadStatus } = useLeads();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userRoles, setUserRoles] = useState<RoleRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: "", email: "", password: "", role: "eligibility" as string });
  const [doctorForm, setDoctorForm] = useState({ fullName: "", email: "", password: "", npi: "" });
  const [adding, setAdding] = useState(false);
  const [editUser, setEditUser] = useState<ProfileRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "leads" | "chat">("leads");
  const [noteModal, setNoteModal] = useState<{ leadId: string; patientName: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DbLead | null>(null);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);

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

  if (!hasAdminAccess) return <Navigate to="/" replace />;

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
    if (addForm.password.length < 8) {
      toast({ title: "Validation Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (addForm.fullName.length > 100 || /[<>{}]/.test(addForm.fullName)) {
      toast({ title: "Validation Error", description: "Invalid name format.", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await callManageUsers({
        action: "create",
        email: addForm.email.trim(),
        password: addForm.password,
        fullName: addForm.fullName.trim(),
        role: addForm.role,
      });
      toast({ title: "User created", description: `${addForm.email} has been added.` });
      setAddForm({ fullName: "", email: "", password: "", role: "eligibility" });
      setShowAddUser(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setAdding(false);
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (doctorForm.password.length < 8) {
      toast({ title: "Validation Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(doctorForm.npi)) {
      toast({ title: "Validation Error", description: "NPI must be exactly 10 digits.", variant: "destructive" });
      return;
    }
    if (doctorForm.fullName.length > 100 || /[<>{}]/.test(doctorForm.fullName)) {
      toast({ title: "Validation Error", description: "Invalid name format.", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await callManageUsers({
        action: "create_doctor",
        email: doctorForm.email.trim(),
        password: doctorForm.password,
        fullName: doctorForm.fullName.trim(),
        npi: doctorForm.npi.trim(),
      });
      toast({ title: "Doctor created", description: `${doctorForm.email} has been added.` });
      setDoctorForm({ fullName: "", email: "", password: "", npi: "" });
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
    setEditForm({ fullName: p.full_name || "", email: p.email || "", role: ur[0] || "" });
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      await callManageUsers({
        action: "update",
        userId: editUser.user_id,
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
      });
      toast({ title: "User updated", description: "Changes saved." });
      setEditUser(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
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

  const handleAddNote = async () => {
    if (!noteModal || !noteText.trim()) return;
    setAddingNote(true);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: noteModal.leadId,
      text: noteText.trim(),
      author: profile?.full_name || "Admin",
      is_internal: false,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Note added", description: "Note has been added to the lead." });
    }
    setNoteText("");
    setNoteModal(null);
    setAddingNote(false);
  };

  const availableStatusesForRole = (currentStatus: string) => getAvailableStatuses(currentStatus, roles);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onNotificationClick={(patientName) => {
          const lead = leads.find((l) => l.patient_name === patientName);
          if (lead) setSelectedLead(lead);
        }}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 space-y-6">
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
          {isAdmin && activeTab === "users" && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>

        {/* Stats - only for admin */}
        {isAdmin && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">{profiles.length}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">{leads.length}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">
                  {userRoles.filter((r) => r.role === "admin").length}
                </p>
                <p className="text-xs text-muted-foreground">Admins</p>
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
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
          </button>
        </div>

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {leadsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
              </div>
            ) : leads.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No leads yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docs</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, idx) => {
                      const availStatuses = availableStatusesForRole(lead.status);
                      return (
                        <tr key={lead.id} className={`border-b border-border transition-colors hover:bg-muted/30 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
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
                                  <option value={lead.status}>{lead.status}</option>
                                  {availStatuses.filter(s => s !== lead.status).map((s) => (
                                    <option key={s} value={s}>{s}</option>
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
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roles</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">NPI</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
                    {isAdmin && <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.map((p) => (
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
                          <button
                            onClick={() => openEditUser(p)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                            title="Edit user"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

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
                <h2 className="font-display text-lg font-bold text-foreground">Add Staff User</h2>
                <button onClick={() => setShowAddUser(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full Name</label>
                  <input type="text" value={addForm.fullName} onChange={(e) => setAddForm((p) => ({ ...p, fullName: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="John Doe" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                  <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="user@company.com" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
                  <input type="password" value={addForm.password} onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="••••••••" required minLength={8} />
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
                    {adding ? "Creating..." : "Create User"}
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
                <h2 className="font-display text-lg font-bold text-foreground">Add Doctor</h2>
                <button onClick={() => setShowAddDoctor(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleAddDoctor} className="p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Doctor Name</label>
                  <input type="text" value={doctorForm.fullName} onChange={(e) => setDoctorForm((p) => ({ ...p, fullName: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="Dr. John Smith" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                  <input type="email" value={doctorForm.email} onChange={(e) => setDoctorForm((p) => ({ ...p, email: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="doctor@clinic.com" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
                  <input type="password" value={doctorForm.password} onChange={(e) => setDoctorForm((p) => ({ ...p, password: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="••••••••" required minLength={8} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">NPI</label>
                  <input type="text" value={doctorForm.npi} onChange={(e) => setDoctorForm((p) => ({ ...p, npi: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring" placeholder="1234567890" required pattern="\d{10}" title="NPI must be exactly 10 digits" maxLength={10} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddDoctor(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">Cancel</button>
                  <button type="submit" disabled={adding} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
                    {adding ? "Creating..." : "Create Doctor"}
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
    </div>
  );
};

export default AdminPanel;
