import { DbLead } from "@/hooks/useLeads";
import { LeadStatus, UserRole } from "@/types/lead";
import { StatusBadge } from "./StatusBadge";
import { X, User, MapPin, Phone, Mail, FileText, MessageSquare, Calendar, ExternalLink } from "lucide-react";
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card shadow-2xl animate-fade-in overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-foreground">{lead.patient_name}</h2>
              <p className="text-xs text-muted-foreground">Lead #{lead.id.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Status</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={lead.status as LeadStatus} />
              {canUpdateStatus && (
                <button
                  onClick={() => setEditingStatus(!editingStatus)}
                  className="text-xs text-primary hover:underline"
                >
                  {editingStatus ? "Cancel" : "Change"}
                </button>
              )}
            </div>
          </div>

          {editingStatus && canUpdateStatus && onUpdateStatus && (
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.filter((s) => s !== lead.status).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onUpdateStatus(lead.id, s);
                    setEditingStatus(false);
                  }}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {lead.denial_reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive">Denial Reason</p>
              <p className="text-sm text-destructive/80 mt-1">{lead.denial_reason}</p>
            </div>
          )}

          {/* Patient Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient Information</h3>
            <div className="grid gap-2.5">
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="DOB" value={lead.dob} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone || "—"} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email || "—"} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={lead.address || "—"} />
            </div>
          </div>

          {/* Insurance */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insurance</h3>
            <div className="grid gap-2.5">
              <InfoRow icon={<FileText className="h-4 w-4" />} label="Medicare ID" value={lead.medicare_id} />
              <InfoRow icon={<FileText className="h-4 w-4" />} label="PPO" value={lead.ppo_id || "—"} />
            </div>
          </div>

          {lead.dme_items && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">DME Items</h3>
              <p className="text-sm font-medium text-foreground">{lead.dme_items}</p>
            </div>
          )}

          {lead.tracking_number && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking</h3>
              <p className="text-sm font-mono text-primary">{lead.tracking_number}</p>
            </div>
          )}

          {/* Documents */}
          {lead.documents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents ({lead.documents.length})</h3>
              <div className="space-y-2">
                {lead.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-muted-foreground">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  </div>
);
