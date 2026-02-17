import { useState } from "react";
import { LeadStatus } from "@/types/lead";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { PatientTable } from "@/components/PatientTable";
import { PatientDrawer } from "@/components/PatientDrawer";
import { SubmitLeadModal } from "@/components/SubmitLeadModal";
import { LifecycleBar } from "@/components/LifecycleBar";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { InlinePrescriptions } from "@/components/InlinePrescriptions";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Filter, Trash2 } from "lucide-react";
import { useLeads, DbLead } from "@/hooks/useLeads";

const Index = () => {
  const { user, loading, hasAdminAccess, isDoctor, roles } = useAuth();
  const { leads, loading: leadsLoading, createLead, updateLeadStatus, softDeleteLeads, permanentDeleteLeads } = useLeads();
  const [selectedLead, setSelectedLead] = useState<DbLead | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (hasAdminAccess && !isDoctor) return <Navigate to="/admin" replace />;

  const currentRole = roles[0] || "doctor";

  const filteredLeads = leads.filter((l) => {
    const matchesStatus = statusFilter === "All" || l.status === statusFilter;
    const matchesSearch = !searchQuery || l.patient_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleSubmitLead = async (data: {
    patientName: string;
    dob: string;
    phone: string;
    address: string;
    item: string;
    diagnosis: string;
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

  const handleSoftDelete = async () => {
    if (selectedIds.length === 0) return;
    await softDeleteLeads(selectedIds);
    setSelectedIds([]);
    setDeleteDialogOpen(false);
  };

  const handlePermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    await permanentDeleteLeads(selectedIds);
    setSelectedIds([]);
    setDeleteDialogOpen(false);
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

  const allStatuses: { value: LeadStatus | "All"; label: string }[] = [
    { value: "All", label: "All" },
    { value: "New Lead", label: "New Patient" },
    { value: "Pending", label: "Pending" },
    { value: "Eligible", label: "Eligible" },
    { value: "Not Eligible", label: "Not Eligible" },
    { value: "Need Additional Documents", label: "Need Additional Documents" },
    { value: "Shipped", label: "Shipped" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNotificationClick={(patientName) => {
          const lead = leads.find((l) => l.patient_name === patientName);
          if (lead) setSelectedLead(lead);
        }}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Left column: Leads */}
          <div className="space-y-6 min-w-0">
            <LifecycleBar />
            <StatsBar leads={leads} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Mobile-only filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0 mr-1" />
                {allStatuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                      statusFilter === s.value
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (() => {
                  const allNewLead = selectedIds.every((id) => {
                    const lead = leads.find((l) => l.id === id);
                    return lead?.status === "New Lead";
                  });
                  return allNewLead ? (
                    <button
                      onClick={() => setDeleteDialogOpen(true)}
                      className="flex items-center gap-1.5 shrink-0 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm transition-all hover:opacity-90"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete ({selectedIds.length})
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Cannot delete leads that have been processed</span>
                  );
                })()}
                <button
                  onClick={() => setIsSubmitOpen(true)}
                  className="shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
                >
                  + New Patient
                </button>
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
          </div>

          {/* Right column: Prescriptions + Filters */}
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              <InlinePrescriptions />

              {/* Status filters */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Filter by Status</h3>
                {allStatuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                      statusFilter === s.value
                        ? "swoosh-gradient text-white shadow-md"
                        : "border border-border bg-card text-muted-foreground hover:bg-muted hover:border-primary/30"
                    }`}
                  >
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <PatientDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        currentRole={currentRole as any}
        canUpdateStatus={false}
        onUpdateStatus={handleUpdateLeadStatus}
      />
      <SubmitLeadModal isOpen={isSubmitOpen} onClose={() => setIsSubmitOpen(false)} onSubmit={handleSubmitLead} />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        count={selectedIds.length}
        onSoftDelete={handleSoftDelete}
        onPermanentDelete={handlePermanentDelete}
      />
    </div>
  );
};

export default Index;
