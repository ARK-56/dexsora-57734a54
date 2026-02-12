import { Lead, UserRole } from "@/types/lead";
import { StatusBadge } from "./StatusBadge";
import { X, User, MapPin, Phone, Mail, FileText, MessageSquare, Calendar } from "lucide-react";

interface PatientDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  currentRole: UserRole;
}

export const PatientDrawer = ({ lead, onClose, currentRole }: PatientDrawerProps) => {
  if (!lead) return null;

  const showInternalNotes = currentRole !== "doctor";

  const visibleNotes = lead.notes.filter((n) => (showInternalNotes ? true : !n.isInternal));

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card shadow-2xl animate-fade-in overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-foreground">{lead.patientName}</h2>
              <p className="text-xs text-muted-foreground">Lead #{lead.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Status</span>
            <StatusBadge status={lead.status} />
          </div>

          {lead.denialReason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive">Denial Reason</p>
              <p className="text-sm text-destructive/80 mt-1">{lead.denialReason}</p>
            </div>
          )}

          {/* Patient Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient Information</h3>
            <div className="grid gap-2.5">
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="DOB" value={lead.dob} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={lead.address} />
            </div>
          </div>

          {/* Insurance */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insurance</h3>
            <div className="grid gap-2.5">
              <InfoRow icon={<FileText className="h-4 w-4" />} label="Medicare ID" value={lead.medicareId} />
              <InfoRow icon={<FileText className="h-4 w-4" />} label="PPO" value={lead.ppoId} />
            </div>
          </div>

          {lead.trackingNumber && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking</h3>
              <p className="text-sm font-mono text-primary">{lead.trackingNumber}</p>
            </div>
          )}

          {/* Documents */}
          {lead.documents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents</h3>
              <div className="space-y-2">
                {lead.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.uploadedBy} · {doc.uploadedAt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                {showInternalNotes ? "Activity & Notes" : "Notes"}
              </span>
            </h3>
            <div className="space-y-3">
              {visibleNotes.map((note) => (
                <div key={note.id} className="relative border-l-2 border-primary/30 pl-4 py-1">
                  <p className="text-sm text-foreground">{note.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {note.author} · {note.date}
                    {note.isInternal && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Internal
                      </span>
                    )}
                  </p>
                </div>
              ))}
              {visibleNotes.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No notes yet.</p>
              )}
            </div>
          </div>
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
