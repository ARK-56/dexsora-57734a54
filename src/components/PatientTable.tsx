import { Lead } from "@/types/lead";
import { StatusBadge } from "./StatusBadge";

interface PatientTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

export const PatientTable = ({ leads, onSelectLead }: PatientTableProps) => {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Patient
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Submit Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  DME Items
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Note
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, idx) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/30 ${
                    idx % 2 === 1 ? "bg-muted/10" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono font-medium text-muted-foreground whitespace-nowrap">
                    #{lead.id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-foreground uppercase">{lead.patientName}</p>
                    <p className="text-xs text-muted-foreground">DOB: {lead.dob}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {lead.createdAt}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                    {lead.dmeItems || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                    {lead.notes[0]?.text || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{lead.updatedAt}</td>
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
              <div>
                <p className="font-semibold text-foreground">{lead.patientName}</p>
                <p className="text-xs text-muted-foreground">DOB: {lead.dob}</p>
              </div>
              <StatusBadge status={lead.status} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 border-t border-border pt-2">
              <span>Submitted: {lead.createdAt}</span>
              {lead.dmeItems && <span>{lead.dmeItems}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
