import { useState, useRef } from "react";
import { X, Upload, FileText, Trash2, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface SubmitLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    patientName: string;
    dob: string;
    phone: string;
    address: string;
    item: string;
    diagnosis: string;
    documents: { name: string; url: string }[];
  }) => void;
}

export const SubmitLeadModal = ({ isOpen, onClose, onSubmit }: SubmitLeadModalProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    patientName: "",
    dob: "",
    phone: "",
    address: "",
    item: "",
    diagnosis: "",
  });
  const [dobDate, setDobDate] = useState<Date | undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDateSelect = (date: Date | undefined) => {
    setDobDate(date);
    if (date) {
      setForm((p) => ({ ...p, dob: format(date, "MM/dd/yyyy") }));
    }
  };

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
    
    // Client-side validation
    const sanitize = (s: string) => s.replace(/[<>{}]/g, '').trim();
    const sanitizedForm = {
      patientName: sanitize(form.patientName),
      dob: form.dob,
      phone: sanitize(form.phone),
      address: sanitize(form.address),
      item: sanitize(form.item),
      diagnosis: sanitize(form.diagnosis),
    };

    if (sanitizedForm.patientName.length > 100) {
      toast({ title: "Validation Error", description: "Patient name must be under 100 characters.", variant: "destructive" });
      return;
    }
    if (sanitizedForm.phone && !/^[\d\s()+-]+$/.test(sanitizedForm.phone)) {
      toast({ title: "Validation Error", description: "Invalid phone number format.", variant: "destructive" });
      return;
    }
    if (sanitizedForm.address.length > 300) {
      toast({ title: "Validation Error", description: "Address must be under 300 characters.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const uploadedDocs: { name: string; url: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      
      const { data, error } = await supabase.storage
        .from("lead-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}: ${error.message}`,
          variant: "destructive",
        });
      } else {
        // Store file path instead of public URL for security
        uploadedDocs.push({ name: file.name, url: filePath });
      }
      
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    onSubmit({ ...sanitizedForm, documents: uploadedDocs });
    setForm({ patientName: "", dob: "", phone: "", address: "", item: "", diagnosis: "" });
    setDobDate(undefined);
    setFiles([]);
    setUploading(false);
    setUploadProgress(0);
    onClose();
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Submit New Lead</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Fill in patient and product details</p>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Section: Patient Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                Patient Information
                <span className="h-px flex-1 bg-border" />
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={form.patientName} onChange={set("patientName")} required placeholder="Patient full name" />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Date of Birth <span className="text-destructive">*</span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-10 w-full justify-start text-left font-normal border-input bg-background",
                          !dobDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dobDate ? format(dobDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[60]" align="start">
                      <Calendar
                        mode="single"
                        selected={dobDate}
                        onSelect={handleDateSelect}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <input type="hidden" name="dob" value={form.dob} required />
                </div>
                <Field label="Phone No" value={form.phone} onChange={set("phone")} required placeholder="(555) 000-0000" />
                <div className="col-span-2">
                  <Field label="Address" value={form.address} onChange={set("address")} required placeholder="123 Main St, City, State ZIP" />
                </div>
              </div>
            </div>

            {/* Section: Product */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                Product
                <span className="h-px flex-1 bg-border" />
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Item" value={form.item} onChange={set("item")} required placeholder="e.g. Knee Brace" />
                <Field label="Diagnosis" value={form.diagnosis} onChange={set("diagnosis")} required placeholder="e.g. M17.11" />
              </div>
            </div>

            {/* Section: Documents */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                Documents
                <span className="h-px flex-1 bg-border" />
              </h3>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/20 px-4 py-6 text-sm text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, JPG, PNG — Multiple files allowed</p>
                </div>
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
                <div className="space-y-1.5">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm group/file">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate text-xs">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="opacity-0 group-hover/file:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload progress */}
            {uploading && files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uploading documents...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading || !form.patientName || !form.dob || !form.phone || !form.address || !form.item || !form.diagnosis}
                className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Submit Lead"
                )}
              </Button>
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
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
    />
  </div>
);
