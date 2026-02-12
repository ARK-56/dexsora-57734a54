import { useState } from "react";
import { Lead, LeadStatus, UserRole } from "@/types/lead";
import { mockLeads } from "@/data/mockLeads";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { PatientTable } from "@/components/PatientTable";
import { PatientDrawer } from "@/components/PatientDrawer";
import { SubmitLeadModal } from "@/components/SubmitLeadModal";
import { LifecycleBar } from "@/components/LifecycleBar";
import { Filter } from "lucide-react";

const Index = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>("admin");
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");

  const filteredLeads =
    statusFilter === "All"
      ? leads
      : leads.filter((l) => l.status === statusFilter);

  const handleSubmitLead = (data: {
    patientName: string;
    dob: string;
    phone: string;
    email: string;
    address: string;
    medicareId: string;
    ppoId: string;
  }) => {
    const newLead: Lead = {
      id: `A${100 + leads.length + 1}`,
      ...data,
      status: "Pending",
      notes: [],
      documents: [],
      createdAt: new Date().toLocaleDateString(),
      updatedAt: new Date().toLocaleDateString(),
    };
    setLeads((prev) => [newLead, ...prev]);
  };

  const allStatuses: (LeadStatus | "All")[] = [
    "All",
    "Pending",
    "Open",
    "Auth",
    "Approved",
    "Delivered",
    "Closed",
    "Denied (SNS)",
    "Denied (Auth)",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header currentRole={currentRole} onRoleChange={setCurrentRole} />

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6 space-y-6">
        {/* Lifecycle overview */}
        <LifecycleBar />

        {/* Stats */}
        <StatsBar leads={leads} />

        {/* Toolbar */}
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

          {(currentRole === "doctor" || currentRole === "admin") && (
            <button
              onClick={() => setIsSubmitOpen(true)}
              className="shrink-0 rounded-xl bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground shadow-sm transition-all hover:opacity-90"
            >
              ➕ Submit New Lead
            </button>
          )}
        </div>

        {/* Table */}
        <PatientTable leads={filteredLeads} onSelectLead={setSelectedLead} />

        {filteredLeads.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-lg text-muted-foreground">No leads found for this filter.</p>
          </div>
        )}
      </main>

      {/* Side Drawer */}
      <PatientDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} currentRole={currentRole} />

      {/* Submit Modal */}
      <SubmitLeadModal isOpen={isSubmitOpen} onClose={() => setIsSubmitOpen(false)} onSubmit={handleSubmitLead} />
    </div>
  );
};

export default Index;
