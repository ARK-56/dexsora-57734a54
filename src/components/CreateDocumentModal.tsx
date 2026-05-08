import { useState } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: (file: File) => void;
  patientName: string;
  dob: string;
  phone: string;
  address: string;
  product: string;
  hcpcCode: string;
  diagnosis: string;
}

export const CreateDocumentModal = ({
  isOpen,
  onClose,
  onDocumentCreated,
  patientName,
  dob,
  phone,
  address,
  product,
  hcpcCode,
  diagnosis,
}: CreateDocumentModalProps) => {
  const { profile } = useAuth();
  const [conservativeMonths, setConservativeMonths] = useState("");
  const [quantity, setQuantity] = useState("");
  const [duration, setDuration] = useState("");
  const [style, setStyle] = useState("");
  const [necessityCert, setNecessityCert] = useState(false);
  const [signConsent, setSignConsent] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (!isOpen) return null;

  const missingPatientData = !patientName || !product || !hcpcCode || !diagnosis;
  const canGenerate =
    !missingPatientData &&
    conservativeMonths.trim() &&
    quantity.trim() &&
    duration.trim() &&
    necessityCert &&
    signConsent;

  const doctorName = profile?.full_name || "Unknown";
  const doctorNpi = profile?.npi || "N/A";

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 20;
      const maxW = pageWidth - marginX * 2;
      let y = 20;

      const writeWrapped = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
        doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
        doc.setFontSize(opts?.size ?? 11);
        const lines = doc.splitTextToSize(text, maxW);
        for (const line of lines) {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, marginX, y);
          y += (opts?.size ?? 11) * 0.5 + 1.5;
        }
        y += opts?.gap ?? 2;
      };

      // Title
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("Letter of Medical Necessity", pageWidth / 2, y, { align: "center" });
      y += 8;
      doc.setDrawColor(0);
      doc.setLineWidth(0.4);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 10;

      const today = format(new Date(), "MM/dd/yyyy");
      writeWrapped(`Date: ${today}`, { gap: 6 });

      writeWrapped(
        "I am writing to request a medical necessity authorization for gradient compression stockings for my patient.",
        { gap: 6 }
      );

      // Patient Details
      writeWrapped("Patient Details:", { bold: true, size: 12, gap: 3 });
      writeWrapped(`Name: ${patientName}`);
      writeWrapped(`Date of Birth: ${dob || "—"}`);
      writeWrapped(`Phone: ${phone || "—"}`);
      writeWrapped(`Address: ${address || "—"}`, { gap: 6 });

      writeWrapped(`Product: ${product}`);
      writeWrapped(`HCPC: ${hcpcCode}`, { gap: 6 });

      // Clinical Diagnosis
      writeWrapped("Clinical Diagnosis:", { bold: true, size: 12, gap: 3 });
      writeWrapped(`The patient has been diagnosed with ${diagnosis}.`, { gap: 6 });

      // Medical Necessity
      writeWrapped("Medical Necessity:", { bold: true, size: 12, gap: 3 });
      writeWrapped(
        `Conservative treatments, including leg elevation and exercise, have been attempted for ${conservativeMonths} month(s) but have proven insufficient in managing the patient's symptoms and preventing further complications.`,
        { gap: 6 }
      );

      // Prescription Details
      writeWrapped("Prescription Details:", { bold: true, size: 12, gap: 3 });
      writeWrapped(`I am prescribing ${product} with the following specifications:`, { gap: 4 });
      writeWrapped(`• Quantity: ${quantity}`);
      writeWrapped(`• Duration of use: ${duration}`);
      if (style.trim()) writeWrapped(`• Style: ${style}`);
      y += 2;
      writeWrapped(
        "These garments are a vital component of the patient's treatment plan to improve venous return and reduce the risk of complications.",
        { gap: 8 }
      );

      // Certification
      writeWrapped(
        "I certify that the prescribed gradient compression stockings are medically necessary for this patient's treatment and that the clinical information provided is true and accurate to the best of my knowledge.",
        { gap: 8 }
      );

      // Signature block
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 8;
      writeWrapped("Electronic Signature", { bold: true, size: 12, gap: 3 });
      writeWrapped("This document has been electronically signed by:");
      writeWrapped(`Dr. ${doctorName}`, { bold: true });
      writeWrapped(`NPI: ${doctorNpi}`);
      writeWrapped(`Date: ${today}`);

      const pdfBlob = doc.output("blob");
      const fileName = `MedicalNecessity_${patientName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      onDocumentCreated(file);

      // Reset
      setConservativeMonths("");
      setQuantity("");
      setDuration("");
      setStyle("");
      setNecessityCert(false);
      setSignConsent(false);
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
              <p className="text-xs text-muted-foreground mt-0.5">Generate a Letter of Medical Necessity</p>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {missingPatientData && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                Please fill in the patient name, product, HCPC code, and diagnosis on the New Patient form before creating this document.
              </div>
            )}

            {/* Auto-filled summary */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">Auto-Filled From Form</label>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1 text-xs text-foreground">
                <p><span className="text-muted-foreground">Patient:</span> {patientName || "—"}</p>
                <p><span className="text-muted-foreground">DOB:</span> {dob || "—"}</p>
                <p><span className="text-muted-foreground">Address:</span> {address || "—"}</p>
                <p><span className="text-muted-foreground">Product:</span> {product || "—"}</p>
                <p><span className="text-muted-foreground">HCPC:</span> {hcpcCode || "—"}</p>
                <p><span className="text-muted-foreground">Diagnosis:</span> {diagnosis || "—"}</p>
              </div>
            </div>

            {/* Conservative treatment months */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Conservative Treatment Duration (months) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={0}
                value={conservativeMonths}
                onChange={(e) => setConservativeMonths(e.target.value)}
                placeholder="e.g. 6"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Quantity <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 2 pairs every 6 months"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Duration of Use <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. Lifetime / Daily wear"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Style */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Style <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="e.g. Thigh, Full Leg, Calf, Arm"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Necessity certification */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <input
                type="checkbox"
                checked={necessityCert}
                onChange={(e) => setNecessityCert(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary accent-primary shrink-0"
              />
              <label className="text-xs text-muted-foreground leading-relaxed cursor-pointer" onClick={() => setNecessityCert(!necessityCert)}>
                I certify that the prescribed gradient compression stockings are medically necessary for this patient's treatment and that the clinical information provided is true and accurate to the best of my knowledge.
              </label>
            </div>

            {/* Sign consent */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <input
                type="checkbox"
                checked={signConsent}
                onChange={(e) => setSignConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary accent-primary shrink-0"
              />
              <label className="text-xs text-muted-foreground leading-relaxed cursor-pointer" onClick={() => setSignConsent(!signConsent)}>
                I consent to electronically sign this document. This will apply my name ({doctorName}), NPI ({doctorNpi}), and today's date as the electronic signature.
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
              disabled={generating || !canGenerate}
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
