import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Building2, Trash2, X, Stethoscope, Users, Plus, Package } from "lucide-react";

interface OrgMember {
  user_id: string;
  role: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  npi: string | null;
  is_owner: boolean;
}

const INVITE_ROLES = [
  { value: "doctor", label: "Doctor" },
  { value: "eligibility", label: "Eligibility" },
  { value: "auth_team", label: "Auth Team" },
  { value: "shipment", label: "Shipment" },
  { value: "billing", label: "Billing" },
];

const formatRole = (role: string) =>
  role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const OrgSettings = () => {
  const { user, loading: authLoading, isSuperAdmin, hasAdminAccess, isDoctor } = useAuth();
  const { currentOrg, isOrgOwner, isOrgAdmin, loading: orgLoading } = useOrg();
  const { toast } = useToast();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "doctor", npi: "" });
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);

  const callOrgApi = useCallback(async (body: any) => {
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
        body: JSON.stringify(body),
      }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Request failed");
    return result;
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingMembers(true);
    try {
      const result = await callOrgApi({ action: "list_members", organizationId: currentOrg.id });
      setMembers(result.members || []);
    } catch (err: any) {
      console.error("Failed to fetch members:", err);
    }
    setLoadingMembers(false);
  }, [currentOrg, callOrgApi]);

  useEffect(() => {
    if (currentOrg) fetchMembers();
  }, [currentOrg, fetchMembers]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isSuperAdmin) return <Navigate to="/super-admin" replace />;
  if (!currentOrg) return <Navigate to="/" replace />;
  if (!isOrgOwner && !isOrgAdmin) return <Navigate to="/" replace />;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteForm.role === "doctor" && inviteForm.npi && !/^\d{10}$/.test(inviteForm.npi)) {
      toast({ title: "Validation Error", description: "NPI must be exactly 10 digits.", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      await callOrgApi({
        action: "invite_member",
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        organizationId: currentOrg.id,
        npi: inviteForm.role === "doctor" ? inviteForm.npi.trim() : undefined,
      });
      toast({ title: "Invitation sent", description: `Invitation sent to ${inviteForm.email}.` });
      setInviteForm({ email: "", role: "doctor", npi: "" });
      setShowInvite(false);
      await fetchMembers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setInviting(false);
  };

  const handleRemoveMember = async () => {
    if (!confirmRemove) return;
    setRemovingId(confirmRemove.user_id);
    try {
      await callOrgApi({
        action: "remove_member",
        userId: confirmRemove.user_id,
        organizationId: currentOrg.id,
      });
      toast({ title: "Member removed", description: `${confirmRemove.full_name || confirmRemove.email} has been removed.` });
      setConfirmRemove(null);
      await fetchMembers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setRemovingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-6 lg:px-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Organization Settings</h1>
              <p className="text-sm text-muted-foreground">Manage {currentOrg.name}</p>
            </div>
          </div>
          {(isOrgOwner || isOrgAdmin) && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </div>

        {/* Org Info Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl swoosh-gradient">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{currentOrg.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {currentOrg.plan_type}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> {members.length} member{members.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Management */}
        <OrgItemsManager orgId={currentOrg.id} />

        {/* Members Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground">Team Members</h3>
          </div>
          {loadingMembers ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No members yet. Invite your first team member!</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="swoosh-gradient">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">NPI</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Joined</th>
                  {isOrgOwner && (
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/90">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-semibold text-foreground">
                        {m.full_name || "—"}
                        {m.is_owner && (
                          <span className="ml-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                            OWNER
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {formatRole(m.role)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground">{m.npi || "—"}</td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    {isOrgOwner && (
                      <td className="px-6 py-3.5 text-right">
                        {!m.is_owner && (
                          <button
                            onClick={() => setConfirmRemove(m)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Invite Modal */}
      {showInvite && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">Invite Team Member</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Invite to {currentOrg.name}</p>
                </div>
                <button onClick={() => setShowInvite(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleInvite} className="p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                    placeholder="member@clinic.com"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                  >
                    {INVITE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                {inviteForm.role === "doctor" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">NPI (Optional)</label>
                    <input
                      type="text"
                      value={inviteForm.npi}
                      onChange={(e) => setInviteForm((p) => ({ ...p, npi: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                      placeholder="1234567890"
                      maxLength={10}
                    />
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowInvite(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    Cancel
                  </button>
                  <button type="submit" disabled={inviting} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
                    {inviting ? "Sending..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Remove Confirmation */}
      {confirmRemove && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setConfirmRemove(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="p-6 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-center">
                  <h3 className="font-display text-lg font-bold text-foreground">Remove Member</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Are you sure you want to remove <span className="font-semibold text-foreground">{confirmRemove.full_name || confirmRemove.email}</span> from {currentOrg.name}?
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setConfirmRemove(null)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    Cancel
                  </button>
                  <button
                    onClick={handleRemoveMember}
                    disabled={removingId === confirmRemove.user_id}
                    className="rounded-lg bg-destructive px-6 py-2.5 text-sm font-semibold text-destructive-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {removingId === confirmRemove.user_id ? "Removing..." : "Remove"}
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

// Item management component
const OrgItemsManager = ({ orgId }: { orgId: string }) => {
  const { toast } = useToast();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("org_items")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name");
    setItems((data as { id: string; name: string }[]) || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async () => {
    const trimmed = newItem.replace(/[<>{}]/g, "").trim();
    if (!trimmed || trimmed.length > 100) return;
    const { error } = await supabase
      .from("org_items")
      .insert({ organization_id: orgId, name: trimmed });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewItem("");
      fetchItems();
      toast({ title: "Item added", description: `"${trimmed}" has been added.` });
    }
  };

  const deleteItem = async (id: string) => {
    await supabase.from("org_items").delete().eq("id", id);
    fetchItems();
    toast({ title: "Item removed" });
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Product Items</h3>
        </div>
        <span className="text-xs text-muted-foreground">Items available to doctors in the New Patient form</span>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value.replace(/[<>{}]/g, ""))}
            placeholder="e.g. Knee Brace, CPAP Machine"
            maxLength={100}
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          />
          <button
            onClick={addItem}
            disabled={!newItem.trim()}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">No items yet. Add items that doctors can select when submitting patients.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-3 pr-1.5 py-1.5 text-sm text-foreground">
                {item.name}
                <button
                  onClick={() => deleteItem(item.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgSettings;
