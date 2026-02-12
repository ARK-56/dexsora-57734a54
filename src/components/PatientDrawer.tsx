import { DbLead } from "@/hooks/useLeads";
import { LeadStatus, UserRole } from "@/types/lead";
import { StatusBadge } from "./StatusBadge";
import { X, User, MapPin, Phone, Mail, FileText, Calendar, ExternalLink, Shield, Package } from "lucide-react";
import { useState } from "react";

interface PatientDrawerProps {
  lead: DbLead | null;
  onClose: () => void;
  currentRole: UserRole;
  canUpdateStatus?: boolean;
  onUpdateStatus?: (leadId: string, newStatus: LeadStatus) => void;
}

const ALL_STATUSES: LeadStatus[] = [
  "Pending", "Open", "Auth", "Approved", "Delivered", "Closed", "Denied (SNS)", "Denied (Auth)",
];

export const PatientDrawer = ({ lead, onClose, currentRole, canUpdateStatus, onUpdateStatus }: PatientDrawerProps) => {
  const [editingStatus, setEditingStatus] = useState(false);

  if (!lead) return null;

  const initials = lead.patient_name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card shadow-2xl animate-fade-in overflow-y-auto">
        {/* Header with gradient */}
        <div className="sticky top-0 z-10 border-b border-border bg-card">
          <div className="swoosh-gradient px-5 py-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-primary-foreground/70">Lead #{lead.id.slice(0, 8)}</span>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20">
                <X className="h-4 w-4 text-primary-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/20 text-base font-bold text-primary-foreground">
                {initials}
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-primary-foreground">{lead.patient_name}</h2>
                <p className="text-xs text-primary-foreground/70">DOB: {lead.dob}</p>
              </div>
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={lead.status as LeadStatus} />
              {canUpdateStatus && (
                <button
                  onClick={() => setEditingStatus(!editingStatus)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {editingStatus ? "Cancel" : "Change"}
                </button>
              )}
            </div>
          </div>

          {editingStatus && canUpdateStatus && onUpdateStatus && (
            <div className="flex flex-wrap gap-1.5 px-5 pb-3">
              {ALL_STATUSES.filter((s) => s !== lead.status).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onUpdateStatus(lead.id, s);
                    setEditingStatus(false);
                  }}
                  className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 space-y-5">
          {lead.denial_reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive">Denial Reason</p>
              <p className="text-sm text-destructive/80 mt-1">{lead.denial_reason}</p>
            </div>
          )}

          {/* Patient Info */}
          <Section title="Contact Information">
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone || "—"} />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email || "—"} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={lead.address || "—"} />
          </Section>

          {/* Insurance */}
          <Section title="Insurance">
            <InfoRow icon={<Shield className="h-4 w-4" />} label="Medicare ID" value={lead.medicare_id} />
            <InfoRow icon={<FileText className="h-4 w-4" />} label="PPO ID" value={lead.ppo_id || "—"} />
          </Section>

          {lead.dme_items && (
            <Section title="DME Items">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{lead.dme_items}</span>
              </div>
            </Section>
          )}

          {lead.tracking_number && (
            <Section title="Tracking">
              <p className="text-sm font-mono text-primary bg-primary/5 rounded-md px-3 py-2">{lead.tracking_number}</p>
            </Section>
          )}

          {/* Documents */}
          <Section title={`Documents (${lead.documents.length})`}>
            {lead.documents.length > 0 ? (
              <div className="space-y-2">
                {lead.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:bg-muted/30 hover:border-primary/30 group"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No documents uploaded</p>
            )}
          </Section>

          {/* Timestamps */}
          <div className="border-t border-border pt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Created: {new Date(lead.created_at).toLocaleDateString()}</span>
            <span>Updated: {new Date(lead.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
      {children}
    </div>
  </div>
);

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  </div>
);
