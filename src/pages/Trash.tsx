import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { Navigate, Link } from "react-router-dom";
import { useLeads, DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadStatus } from "@/types/lead";
import { Trash2, RotateCcw, ArrowLeft, Info } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

const Trash = () => {
  const { user, loading, hasAdminAccess, isSuperAdmin } = useAuth();
  const { isOrgOwner, isOrgAdmin } = useOrg();
  const isSuperAdminOnly = isSuperAdmin;
  const isEffectiveAdmin = hasAdminAccess || isOrgAdmin || isOrgOwner;
  const { fetchTrashedLeads, restoreLeads, permanentDeleteLeads } = useLeads();
  const [trashedLeads, setTrashedLeads] = useState<DbLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadTrash = async () => {
    setLoadingTrash(true);
    const data = await fetchTrashedLeads();
    setTrashedLeads(data);
    setLoadingTrash(false);
  };

  useEffect(() => {
    if (user) loadTrash();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isSuperAdminOnly) return <Navigate to="/super-admin" replace />;

  const handleRestore = async () => {
    if (selectedIds.length === 0) return;
    await restoreLeads(selectedIds);
    setSelectedIds([]);
    loadTrash();
  };

  const handlePermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    await permanentDeleteLeads(selectedIds);
    setSelectedIds([]);
    setDeleteDialogOpen(false);
    loadTrash();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === trashedLeads.length ? [] : trashedLeads.map((l) => l.id));
  };

  // Calculate days until auto-deletion (60 days from deleted_at)
  const getDaysUntilDeletion = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const autoDeleteDate = new Date(deletedDate.getTime() + 60 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((autoDeleteDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={isEffectiveAdmin ? "/admin" : "/"} className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-muted">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-display text-xl font-bold text-foreground">Trash</h2>
              <span className="text-sm text-muted-foreground">({trashedLeads.length})</span>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              {isEffectiveAdmin && (
                <button
                  onClick={handleRestore}
                  className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <RotateCcw className="h-4 w-4" /> Restore ({selectedIds.length})
                </button>
              )}
              {isEffectiveAdmin && (
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm transition-all hover:opacity-90"
                >
                  <Trash2 className="h-4 w-4" /> Delete Forever ({selectedIds.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Auto-delete notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-muted-foreground/20 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Items in trash are automatically and permanently deleted after <strong>60 days</strong>.
            {isEffectiveAdmin ? " Admins can restore or permanently delete earlier." : ""}
          </span>
        </div>

        {loadingTrash ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : trashedLeads.length === 0 ? (
          <div className="py-16 text-center">
            <Trash2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-lg text-muted-foreground">Trash is empty</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {isEffectiveAdmin && (
                    <th className="w-10 px-3 py-3 text-center">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedIds.length === trashedLeads.length && trashedLeads.length > 0} onChange={toggleAll} />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deleted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auto-deletes in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trashedLeads.map((lead, idx) => {
                  const daysLeft = lead.deleted_at ? getDaysUntilDeletion(lead.deleted_at) : 60;
                  return (
                    <tr key={lead.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                      {isEffectiveAdmin && (
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelect(lead.id)} />
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-semibold text-foreground">{lead.patient_name}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={lead.status as LeadStatus} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {lead.deleted_at ? new Date(lead.deleted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-destructive" : daysLeft <= 14 ? "text-warning-foreground" : "text-muted-foreground"}`}>
                          {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      {isEffectiveAdmin && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          count={selectedIds.length}
          onSoftDelete={() => {}}
          onPermanentDelete={handlePermanentDelete}
          canPermanentDelete={true}
        />
      )}
    </div>
  );
};

export default Trash;
