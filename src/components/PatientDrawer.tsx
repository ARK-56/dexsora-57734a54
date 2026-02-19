import { DbLead } from "@/hooks/useLeads";
import { LeadStatus, UserRole } from "@/types/lead";
import { StatusBadge } from "./StatusBadge";
import { X, User, MapPin, Phone, Mail, FileText, Calendar, ExternalLink, Shield, Package, Download, ClipboardList, MessageSquare, Upload } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/downloadFile";
import { getSignedUrl } from "@/lib/getSignedUrl";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// For doctor view: only lifecycle statuses shown as-is, everything else shows as "Delivered"
const DOCTOR_LIFECYCLE_STATUSES = ["New Lead", "Pending", "Eligible", "Not Eligible", "Need Additional Documents", "Shipped", "Delivered"];
const getDoctorDisplayStatus = (status: string, isAdmin: boolean): LeadStatus => {
  if (isAdmin) return status as LeadStatus;
  if (DOCTOR_LIFECYCLE_STATUSES.includes(status)) return status as LeadStatus;
  return "Delivered";
};

interface PatientDrawerProps {
  lead: DbLead | null;
  onClose: () => void;
  currentRole: UserRole;
  canUpdateStatus?: boolean;
  onUpdateStatus?: (leadId: string, newStatus: LeadStatus) => void;
}

const ALL_STATUSES: LeadStatus[] = [
  "New Lead", "Pending", "Eligible", "Not Eligible", "Need Additional Documents",
  "Shipped", "Delivered", "Auth Applied", "Billed", "Paid", "Denied",
];

const getAvailableStatuses = (currentStatus: string, roles: string[], isAdminUser: boolean): LeadStatus[] => {
  const isAdmin = roles.includes("admin") || isAdminUser;
  if (isAdmin) return ALL_STATUSES;

  const isEligibility = roles.includes("eligibility");
  const isShipment = roles.includes("shipment");
  const isBilling = roles.includes("billing");

  if (isEligibility && (currentStatus === "New Lead" || currentStatus === "Pending")) {
    return ["Eligible", "Not Eligible", "Need Additional Documents"];
  }
  if (isShipment && (currentStatus === "Eligible" || currentStatus === "Need Additional Documents")) {
    return ["Shipped", "Delivered"];
  }
  if (isBilling && (currentStatus === "Shipped" || currentStatus === "Delivered")) {
    return ["Auth Applied", "Billed", "Paid", "Denied"];
  }
  return [];
};

interface LeadNote {
  id: string;
  text: string;
  author: string;
  created_at: string;
  is_internal: boolean;
}

export const PatientDrawer = ({ lead, onClose, currentRole, canUpdateStatus, onUpdateStatus }: PatientDrawerProps) => {
  const [editingStatus, setEditingStatus] = useState(false);
  const { roles, hasAdminAccess, user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localDocs, setLocalDocs] = useState(lead?.documents ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lead) return;
    setLocalDocs(lead.documents);
    supabase.from("lead_notes").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false })
      .then(({ data }) => setNotes(data || []));
  }, [lead?.id]);

  if (!lead) return null;

  // Filter admin-only docs for non-admin users
  const visibleDocs = hasAdminAccess
    ? localDocs
    : localDocs.filter((d) => !d.is_admin_only);

  // Doctors can upload only when status is "Need Additional Documents"
  const canUploadAdditionalDocs = !hasAdminAccess && lead?.status === "Need Additional Documents";
  // Org admins can upload docs on any status EXCEPT "Need Additional Documents" (that's doctor-only)
  const canAdminUpload = hasAdminAccess && lead?.status !== "Need Additional Documents";

  const handleAdminUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !lead || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${lead.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("lead-documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        await supabase.from("lead_documents").insert({
          lead_id: lead.id,
          name: file.name,
          url: filePath,
          uploaded_by: user.id,
          is_admin_only: hasAdminAccess,
          organization_id: lead.organization_id ?? null,
        } as any);
      }
      toast({ title: "Uploaded", description: `${files.length} document(s) uploaded.` });

      // Refresh documents locally so no page reload needed
      const { data: freshDocs } = await supabase
        .from("lead_documents")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (freshDocs) setLocalDocs(freshDocs as any);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const availableStatuses = getAvailableStatuses(lead.status, roles, hasAdminAccess);

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
              <StatusBadge status={getDoctorDisplayStatus(lead.status, hasAdminAccess)} />
              {canUpdateStatus && availableStatuses.length > 0 && (
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
              {availableStatuses.filter((s) => s !== lead.status).map((s) => (
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

          {/* Doctor Info */}
          {(lead.doctor_name || lead.doctor_npi) && (
            <Section title="Doctor Information">
              {lead.doctor_name && <InfoRow icon={<User className="h-4 w-4" />} label="Doctor" value={lead.doctor_name} />}
              {lead.doctor_npi && <InfoRow icon={<Shield className="h-4 w-4" />} label="NPI" value={lead.doctor_npi} />}
            </Section>
          )}

          {/* Patient Info */}
          <Section title="Contact Information">
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone || "—"} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={lead.address || "—"} />
          </Section>

          {/* Product Info */}
          {(lead.item || lead.diagnosis) && (
            <Section title="Product Information">
              {lead.item && <InfoRow icon={<Package className="h-4 w-4" />} label="Item" value={lead.item} />}
              {lead.diagnosis && <InfoRow icon={<FileText className="h-4 w-4" />} label="Diagnosis" value={lead.diagnosis} />}
            </Section>
          )}

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

          {/* Notes */}
          {notes.length > 0 && (
            <Section title={`Notes (${notes.length})`}>
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm text-foreground">{note.text}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{note.author}</span>
                      <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Documents */}
          <Section title={`Documents (${visibleDocs.length})`}>
          {(canAdminUpload || canUploadAdditionalDocs) && (
              <div className="mb-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleAdminUpload}
                  className="hidden"
                  id="admin-doc-upload"
                />
                {canUploadAdditionalDocs && (
                  <div className="mb-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                    Additional documents have been requested. Please upload them below.
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 w-full justify-center"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Uploading..." : canAdminUpload ? "Upload Admin Document" : "Upload Additional Documents"}
                </button>
              </div>
            )}
            {visibleDocs.length > 0 ? (
              <div className="space-y-2">
                {visibleDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:bg-muted/30 hover:border-primary/30 group"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {doc.name}
                        {doc.is_admin_only && (
                          <span className="ml-1.5 inline-flex rounded-full bg-warning/20 px-1.5 py-0.5 text-[9px] font-bold text-warning-foreground">ADMIN</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={async () => {
                        const url = await getSignedUrl("lead-documents", doc.url);
                        window.open(url, "_blank");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="View"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => downloadFile(doc.url, doc.name)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No documents uploaded yet</p>
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
