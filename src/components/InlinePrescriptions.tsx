import { useState, useEffect } from "react";
import { FileText, Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { downloadFile } from "@/lib/downloadFile";
import { getSignedUrl } from "@/lib/getSignedUrl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Prescription {
  id: string;
  name: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

export const InlinePrescriptions = () => {
  const { currentOrg } = useOrg();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const fetchPrescriptions = async () => {
    setLoading(true);
    if (!currentOrg) {
      setPrescriptions([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setPrescriptions((data as Prescription[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [currentOrg?.id]);

  const filtered = prescriptions.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full rounded-xl swoosh-gradient px-4 py-3 flex items-center gap-2 shadow-sm hover:opacity-90 transition-all">
          <FileText className="h-4 w-4 text-white" />
          <span className="font-display text-sm font-bold text-white">Prescriptions</span>
          <span className="ml-auto text-xs text-white/70 font-medium">
            {prescriptions.length} available
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw] w-[80vw] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Prescriptions
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available ({prescriptions.length})
          </h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : prescriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-8 text-center">No prescriptions yet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {prescriptions.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 transition-all hover:bg-muted/30 hover:border-primary/30 group">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={async () => { const url = await getSignedUrl("lead-documents", p.url); window.open(url, "_blank"); }} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="View">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => downloadFile(p.url, p.name)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
