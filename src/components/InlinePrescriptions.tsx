import { useState, useEffect } from "react";
import { Upload, FileText, Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
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

export const InlinePrescriptions = () => {
  const { user, hasAdminAccess } = useAuth();
  const { currentOrg, isOrgOwner, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const canUpload = hasAdminAccess || isOrgOwner || isOrgAdmin;
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const fetchPrescriptions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("prescriptions")
      .select("*")
      .order("created_at", { ascending: false });
    setPrescriptions((data as Prescription[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
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

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden h-full">
      <div className="swoosh-gradient px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white" />
          <h2 className="font-display text-sm font-bold text-white">Prescriptions</h2>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
        {canUpload && (
          <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upload</h3>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="File name"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-ring"
            />
            <label className={`flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary cursor-pointer transition-colors hover:bg-primary/10 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading..." : "Choose Files"}
              <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
            </label>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available ({prescriptions.length})
          </h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : prescriptions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4 text-center">No prescriptions yet</p>
          ) : (
            <div className="space-y-1.5">
              {prescriptions.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border p-2 transition-all hover:bg-muted/30 hover:border-primary/30 group">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={async () => { const url = await getSignedUrl("lead-documents", p.url); window.open(url, "_blank"); }} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0" title="View">
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button onClick={() => downloadFile(p.url, p.name)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0" title="Download">
                    <Download className="h-3 w-3" />
                  </button>
                  {canUpload && (
                    <button onClick={() => handleDelete(p.id)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
