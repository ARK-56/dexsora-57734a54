import { useState } from "react";
import { DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "./StatusBadge";
import { Star, Download, Trash2 } from "lucide-react";
import { LeadStatus } from "@/types/lead";

interface PatientTableProps {
  leads: DbLead[];
  onSelectLead: (lead: DbLead) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

export const PatientTable = ({ leads, onSelectLead, selectedIds, onToggleSelect, onToggleAll, allSelected }: PatientTableProps) => {
  return (
    <>
      {/* Desktop table — dense CRM/spreadsheet style */}
      <div className="hidden md:block overflow-hidden border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary rounded"
                    checked={allSelected && leads.length > 0}
                    onChange={onToggleAll}
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deal</th>
                <th className="w-20 px-3 py-2.5" />
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updates</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submit Date</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">DME Items</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docs</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, idx) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={`cursor-pointer border-b border-border transition-colors hover:bg-primary/5 ${
                    idx % 2 === 1 ? "bg-muted/20" : ""
                  } ${selectedIds.includes(lead.id) ? "bg-primary/10" : ""}`}
                >
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary rounded"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => onToggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground uppercase whitespace-nowrap max-w-[200px] truncate">
                    {lead.patient_name}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Star className="h-3.5 w-3.5 hover:text-warning cursor-pointer" />
                      <Download className="h-3.5 w-3.5 hover:text-primary cursor-pointer" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={lead.status as LeadStatus} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2">
                    <SecondaryStatus status={lead.status} />
                  </td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">
                    {lead.dme_items || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {lead.documents.length > 0 ? `${lead.documents.length} file${lead.documents.length > 1 ? "s" : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(lead.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelectLead(lead)}
            className="status-card-enter cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow active:shadow-md"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={selectedIds.includes(lead.id)}
                  onChange={(e) => { e.stopPropagation(); onToggleSelect(lead.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <p className="font-semibold text-foreground">{lead.patient_name}</p>
                  <p className="text-xs text-muted-foreground">DOB: {lead.dob}</p>
                </div>
              </div>
              <StatusBadge status={lead.status as LeadStatus} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 border-t border-border pt-2">
              <span>Submitted: {new Date(lead.created_at).toLocaleDateString()}</span>
              {lead.dme_items && <span>{lead.dme_items}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

const SecondaryStatus = ({ status }: { status: string }) => {
  if (status === "Approved" || status === "Delivered" || status === "Closed") {
    return (
      <span className="inline-block rounded px-2.5 py-1 text-xs font-bold text-success-foreground bg-success/80">
        MET
      </span>
    );
  }
  if (status.startsWith("Denied")) {
    return (
      <span className="inline-block rounded px-2.5 py-1 text-xs font-bold text-warning-foreground bg-warning">
        NOT MET
      </span>
    );
  }
  return <span className="inline-block h-6 w-full rounded bg-muted/40" />;
};
