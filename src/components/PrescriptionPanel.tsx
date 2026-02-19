import { useState, useEffect } from "react";
import { X, Upload, FileText, Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { downloadFile } from "@/lib/downloadFile";
import { getSignedUrl } from "@/lib/getSignedUrl";

interface Prescription {
  id: string;
  name: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

interface PrescriptionPanelProps {
  open: boolean;
  onClose: () => void;
}

export const PrescriptionPanel = ({ open, onClose }: PrescriptionPanelProps) => {
  const { user, hasAdminAccess } = useAuth();
  const { currentOrg, isOrgOwner, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const canManagePrescriptions = hasAdminAccess || isOrgOwner || isOrgAdmin;

  const fetchPrescriptions = async () => {
    setLoading(true);
    let query = supabase
      .from("prescriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (currentOrg) {
      query = query.eq("organization_id", currentOrg.id);
    }

    const { data } = await query;
    setPrescriptions((data as Prescription[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchPrescriptions();
  }, [open]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    if (!fileName.trim()) {
      toast({ title: "File name required", description: "Please enter a file name before uploading.", variant: "destructive" });
      return;
    }
    setUploading(true);

    for (const file of Array.from(files)) {
      const filePath = `prescriptions/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("lead-documents")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      // Store the file path (not public URL) since bucket is private
      await supabase.from("prescriptions").insert({
        name: fileName || file.name,
        url: filePath,
        uploaded_by: user.id,
        organization_id: currentOrg?.id || null,
      });
    }

    setUploading(false);
    setFileName("");
    toast({ title: "Uploaded", description: "Prescription uploaded successfully." });
    fetchPrescriptions();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("prescriptions").delete().eq("id", id);
    toast({ title: "Deleted", description: "Prescription removed." });
    fetchPrescriptions();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card shadow-2xl animate-fade-in overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-border bg-card">
          <div className="swoosh-gradient px-5 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-foreground" />
                <h2 className="font-display text-lg font-bold text-primary-foreground">Prescriptions</h2>
              </div>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20">
                <X className="h-4 w-4 text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Admin upload */}
          {canManagePrescriptions && (
            <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upload Prescription</h3>
              <div>
                <label className="text-xs font-medium text-muted-foreground">File Name</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. Prescription Form A"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring"
                />
              </div>
              <label className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary cursor-pointer transition-colors hover:bg-primary/10 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Choose Files"}
                <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
              </label>
            </div>
          )}

          {/* List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Available Prescriptions ({prescriptions.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : prescriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">No prescriptions uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {prescriptions.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:bg-muted/30 hover:border-primary/30 group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={async () => { const url = await getSignedUrl("lead-documents", p.url); window.open(url, "_blank"); }} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0" title="View">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => downloadFile(p.url, p.name)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {canManagePrescriptions && (
                      <button onClick={() => handleDelete(p.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
