import { DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "./StatusBadge";
import { Star, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { LeadStatus } from "@/types/lead";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 10;

interface PatientTableProps {
  leads: DbLead[];
  onSelectLead: (lead: DbLead) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

export const PatientTable = ({ leads, onSelectLead, selectedIds, onToggleSelect, onToggleAll, allSelected }: PatientTableProps) => {
  const [page, setPage] = useState(0);
  const { hasAdminAccess } = useAuth();
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const safeePage = Math.min(page, totalPages - 1);
  const pagedLeads = leads.slice(safeePage * PAGE_SIZE, (safeePage + 1) * PAGE_SIZE);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary rounded"
                    checked={allSelected && leads.length > 0}
                    onChange={onToggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient</th>
                <th className="w-20 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                {hasAdminAccess && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctor</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedLeads.map((lead, idx) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={`cursor-pointer transition-colors hover:bg-accent/40 ${
                    idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                  } ${selectedIds.includes(lead.id) ? "!bg-primary/10 ring-1 ring-inset ring-primary/20" : ""}`}
                >
                  <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary rounded"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => onToggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap max-w-[200px] truncate">
                    {lead.patient_name}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Star className="h-4 w-4 hover:text-warning cursor-pointer transition-colors" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead);
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title={lead.documents.length > 0 ? `View ${lead.documents.length} document(s)` : "No documents yet"}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={lead.status as LeadStatus} />
                  </td>
                  {hasAdminAccess && (
                    <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">
                      <div>
                        <p className="font-medium">{lead.doctor_name || "—"}</p>
                        {lead.doctor_npi && <p className="text-muted-foreground">NPI: {lead.doctor_npi}</p>}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                    {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5 text-foreground whitespace-nowrap text-xs">
                    {lead.item || lead.dme_items || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                    {lead.documents.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
                        {lead.documents.length} file{lead.documents.length > 1 ? "s" : ""}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                    {new Date(lead.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Showing {safeePage * PAGE_SIZE + 1}–{Math.min((safeePage + 1) * PAGE_SIZE, leads.length)} of {leads.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safeePage === 0}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  i === safeePage
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safeePage >= totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelectLead(lead)}
            className="status-card-enter cursor-pointer rounded-lg border border-border bg-card p-4 transition-all active:shadow-md hover:border-primary/30"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selectedIds.includes(lead.id)}
                  onChange={(e) => { e.stopPropagation(); onToggleSelect(lead.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <p className="font-semibold text-foreground">{lead.patient_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">DOB: {lead.dob}</p>
                </div>
              </div>
              <StatusBadge status={lead.status as LeadStatus} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 border-t border-border pt-2">
              <span>Order Date: {new Date(lead.created_at).toLocaleDateString()}</span>
              {(lead.item || lead.dme_items) && <span className="font-medium text-foreground">{lead.item || lead.dme_items}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
