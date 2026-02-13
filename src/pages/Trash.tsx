import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useLeads, DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadStatus } from "@/types/lead";
import { Trash2, RotateCcw, ArrowLeft } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

const Trash = () => {
  const { user, loading, hasAdminAccess, fullyAuthenticated } = useAuth();
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

  if (!user || !fullyAuthenticated) return <Navigate to="/login" replace />;

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-muted">
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
              <button
                onClick={handleRestore}
                className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <RotateCcw className="h-4 w-4" /> Restore ({selectedIds.length})
              </button>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm transition-all hover:opacity-90"
              >
                <Trash2 className="h-4 w-4" /> Delete Forever ({selectedIds.length})
              </button>
            </div>
          )}
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
                  <th className="w-10 px-3 py-3 text-center">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedIds.length === trashedLeads.length && trashedLeads.length > 0} onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deleted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trashedLeads.map((lead, idx) => (
                  <tr key={lead.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="px-3 py-2.5 text-center">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelect(lead.id)} />
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{lead.patient_name}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={lead.status as LeadStatus} /></td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {lead.deleted_at ? new Date(lead.deleted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        count={selectedIds.length}
        onSoftDelete={() => {}}
        onPermanentDelete={handlePermanentDelete}
      />
    </div>
  );
};

export default Trash;
