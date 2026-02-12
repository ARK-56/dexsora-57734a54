import { useState } from "react";
import { LeadStatus } from "@/types/lead";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { PatientTable } from "@/components/PatientTable";
import { PatientDrawer } from "@/components/PatientDrawer";
import { SubmitLeadModal } from "@/components/SubmitLeadModal";
import { LifecycleBar } from "@/components/LifecycleBar";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Filter, Trash2 } from "lucide-react";
import { useLeads, DbLead } from "@/hooks/useLeads";

const Index = () => {
  const { user, loading, hasAdminAccess, roles } = useAuth();
  const { leads, loading: leadsLoading, createLead, updateLeadStatus, deleteLeads } = useLeads();
  const [selectedLead, setSelectedLead] = useState<DbLead | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const currentRole = roles[0] || "doctor";

  const filteredLeads =
    statusFilter === "All"
      ? leads
      : leads.filter((l) => l.status === statusFilter);

  const handleSubmitLead = async (data: {
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
    await createLead(data);
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    await updateLeadStatus(leadId, newStatus);
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    await deleteLeads(selectedIds);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id));
    }
  };

  const allStatuses: (LeadStatus | "All")[] = [
    "All", "Pending", "Open", "Auth", "Approved", "Delivered", "Closed", "Denied (SNS)", "Denied (Auth)",
  ];

  const canSubmit = !hasAdminAccess;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        <LifecycleBar />
        <StatsBar leads={leads} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {allStatuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && hasAdminAccess && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 shrink-0 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground shadow-sm transition-all hover:opacity-90"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedIds.length})
              </button>
            )}
            {canSubmit && (
              <button
                onClick={() => setIsSubmitOpen(true)}
                className="shrink-0 rounded-xl bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground shadow-sm transition-all hover:opacity-90"
              >
                Submit New Lead
              </button>
            )}
          </div>
        </div>

        {leadsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <PatientTable
            leads={filteredLeads}
            onSelectLead={setSelectedLead}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            allSelected={selectedIds.length === filteredLeads.length && filteredLeads.length > 0}
          />
        )}

        {!leadsLoading && filteredLeads.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-lg text-muted-foreground">No leads found for this filter.</p>
          </div>
        )}
      </main>

      <PatientDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        currentRole={currentRole as any}
        canUpdateStatus={hasAdminAccess}
        onUpdateStatus={handleUpdateLeadStatus}
      />
      <SubmitLeadModal isOpen={isSubmitOpen} onClose={() => setIsSubmitOpen(false)} onSubmit={handleSubmitLead} />
    </div>
  );
};

export default Index;
