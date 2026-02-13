import { DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "./StatusBadge";
import { Star, Download, ClipboardList } from "lucide-react";
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Criteria</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">DME Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead, idx) => (
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
                      {lead.documents.length > 0 && (
                        <a
                          href={lead.documents[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="View prescription"
                        >
                          <ClipboardList className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={lead.status as LeadStatus} />
                  </td>
                  <td className="px-4 py-2.5">
                    <SecondaryStatus status={lead.status} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                    {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5 text-foreground whitespace-nowrap text-xs">
                    {lead.dme_items || "—"}
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
              <span>Submitted: {new Date(lead.created_at).toLocaleDateString()}</span>
              {lead.dme_items && <span className="font-medium text-foreground">{lead.dme_items}</span>}
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
      <span className="inline-block rounded-md px-2.5 py-1 text-xs font-bold text-success-foreground bg-success/90">
        MET
      </span>
    );
  }
  if (status.startsWith("Denied")) {
    return (
      <span className="inline-block rounded-md px-2.5 py-1 text-xs font-bold text-warning-foreground bg-warning/90">
        NOT MET
      </span>
    );
  }
  return <span className="inline-block h-6 w-full rounded-md bg-muted/40" />;
};
