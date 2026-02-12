import { useState, useRef } from "react";
import { X, Upload, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SubmitLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    patientName: string;
    dob: string;
    phone: string;
    email: string;
    address: string;
    medicareId: string;
    ppoId: string;
    dmeItems: string;
    documents: { name: string; url: string }[];
  }) => void;
}

export const SubmitLeadModal = ({ isOpen, onClose, onSubmit }: SubmitLeadModalProps) => {
  const [form, setForm] = useState({
    patientName: "",
    dob: "",
    phone: "",
    email: "",
    address: "",
    medicareId: "",
    ppoId: "",
    dmeItems: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    const uploadedDocs: { name: string; url: string }[] = [];

    for (const file of files) {
      const filePath = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("lead-documents")
        .upload(filePath, file);

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("lead-documents")
          .getPublicUrl(filePath);
        uploadedDocs.push({ name: file.name, url: urlData.publicUrl });
      }
    }

    onSubmit({ ...form, documents: uploadedDocs });
    setForm({ patientName: "", dob: "", phone: "", email: "", address: "", medicareId: "", ppoId: "", dmeItems: "" });
    setFiles([]);
    setUploading(false);
    onClose();
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-display text-lg font-bold text-foreground">Submit New Lead</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Patient Name" value={form.patientName} onChange={set("patientName")} required />
              <Field label="Date of Birth" value={form.dob} onChange={set("dob")} type="date" required />
              <Field label="Phone" value={form.phone} onChange={set("phone")} />
              <Field label="Email" value={form.email} onChange={set("email")} type="email" />
              <Field label="Medicare ID" value={form.medicareId} onChange={set("medicareId")} required />
              <Field label="PPO ID" value={form.ppoId} onChange={set("ppoId")} />
              <Field label="DME Items" value={form.dmeItems} onChange={set("dmeItems")} placeholder="e.g. BT Wrist" />
            </div>
            <Field label="Full Address" value={form.address} onChange={set("address")} required />

            {/* Document Upload */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Documents</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-background px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted/30"
              >
                <Upload className="h-4 w-4" />
                <span>Click to upload documents (multiple allowed)</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              {files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="flex-1 truncate text-foreground">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
                      <button type="button" onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Submit Lead"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

const Field = ({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
    />
  </div>
);
