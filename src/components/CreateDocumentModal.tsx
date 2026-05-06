import { useState, useEffect } from "react";
import { X, ChevronDown, FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";

interface OrgItem {
  id: string;
  name: string;
}

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: (file: File) => void;
  patientName: string;
  dob: string;
  phone: string;
  address: string;
}

export const CreateDocumentModal = ({
  isOpen,
  onClose,
  onDocumentCreated,
  patientName,
  dob,
  phone,
  address,
}: CreateDocumentModalProps) => {
  const { profile } = useAuth();
  const { currentOrg } = useOrg();
  const [product, setProduct] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [orgItems, setOrgItems] = useState<OrgItem[]>([]);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [isOtherItem, setIsOtherItem] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentOrg) return;
    const fetchItems = async () => {
      const { data } = await supabase
        .from("org_items")
        .select("id, name")
        .eq("organization_id", currentOrg.id)
        .order("name");
      setOrgItems((data as unknown as OrgItem[]) || []);
    };
    fetchItems();
  }, [isOpen, currentOrg?.id]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!consent || !product || !diagnosis) return;
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Medical Equipment Order Document", pageWidth / 2, y, { align: "center" });
      y += 12;

      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(20, y, pageWidth - 20, y);
      y += 12;

      // Product & Diagnosis
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Product Information", 20, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Product: ${product}`, 20, y);
      y += 7;
      doc.text(`Diagnosis Code: ${diagnosis}`, 20, y);
      y += 12;

      // Patient Info
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Patient Information", 20, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Name: ${patientName}`, 20, y);
      y += 7;
      doc.text(`Date of Birth: ${dob}`, 20, y);
      y += 7;
      doc.text(`Phone: ${phone}`, 20, y);
      y += 7;
      doc.text(`Address: ${address}`, 20, y);
      y += 16;

      // Signature section
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(20, y, pageWidth - 20, y);
      y += 10;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Electronic Signature", 20, y);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      const doctorName = profile?.full_name || "Unknown";
      const doctorNpi = profile?.npi || "N/A";
      const signDate = format(new Date(), "MM/dd/yyyy");

      doc.text("This document has been electronically signed by:", 20, y);
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.text(`Dr. ${doctorName}`, 20, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.text(`NPI: ${doctorNpi}`, 20, y);
      y += 7;
      doc.text(`Date: ${signDate}`, 20, y);
      y += 12;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(
        "I certify that the prescribed medical equipment is medically necessary for the patient's health and well being.",
        20,
        y,
        { maxWidth: pageWidth - 40 }
      );

      // Convert to File
      const pdfBlob = doc.output("blob");
      const fileName = `Order_${patientName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      onDocumentCreated(file);
      // Reset
      setProduct("");
      setDiagnosis("");
      setConsent(false);
      setIsOtherItem(false);
      onClose();
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl animate-fade-in max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Create Document</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Generate a signed order document</p>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Product dropdown */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Product <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setItemDropdownOpen(!itemDropdownOpen)}
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                >
                  <span className={product || isOtherItem ? "text-foreground" : "text-muted-foreground/60"}>
                    {isOtherItem ? "Other" : product || "Select product"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
                {itemDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setItemDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                      {orgItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setProduct(item.name);
                            setIsOtherItem(false);
                            setItemDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                            product === item.name && !isOtherItem ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setProduct("");
                          setIsOtherItem(true);
                          setItemDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-t border-border ${
                          isOtherItem ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        Other
                      </button>
                    </div>
                  </>
                )}
              </div>
              {isOtherItem && (
                <input
                  type="text"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="Enter product name"
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                />
              )}
            </div>

            {/* Diagnosis */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Diagnosis Code <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. M17.11"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Patient Info (read-only summary) */}
            <div className="space-y-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Patient Information</label>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1 text-xs text-foreground">
                <p><span className="text-muted-foreground">Name:</span> {patientName || "—"}</p>
                <p><span className="text-muted-foreground">DOB:</span> {dob || "—"}</p>
                <p><span className="text-muted-foreground">Phone:</span> {phone || "—"}</p>
                <p><span className="text-muted-foreground">Address:</span> {address || "—"}</p>
              </div>
            </div>

            {/* Consent Checkbox */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary accent-primary shrink-0"
              />
              <label className="text-xs text-muted-foreground leading-relaxed cursor-pointer" onClick={() => setConsent(!consent)}>
                I consent to electronically sign this document. This will apply my name ({profile?.full_name || "Doctor"}), NPI ({profile?.npi || "N/A"}), and today's date as the electronic signature.
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !product || !diagnosis || !consent}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px]"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-1" />
                  Generate PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
