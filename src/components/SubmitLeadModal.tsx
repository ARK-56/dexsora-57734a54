import { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Trash2, CalendarIcon, Loader2, ChevronDown, FilePlus } from "lucide-react";
import { CreateDocumentModal } from "@/components/CreateDocumentModal";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/contexts/OrgContext";

interface OrgItem {
  id: string;
  name: string;
}

interface OrgInsurance {
  id: string;
  name: string;
}

interface SubmitLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    patientName: string;
    dob: string;
    phone: string;
    address: string;
    item: string;
    hcpcCode: string;
    diagnosis: string;
    insurance: string;
    shipTo: "patient" | "doctor" | "other";
    shipToOther?: string;
    documents: { name: string; url: string }[];
  }) => void;
}

export const SubmitLeadModal = ({ isOpen, onClose, onSubmit }: SubmitLeadModalProps) => {
  const { toast } = useToast();
  const { currentOrg } = useOrg();
  const [form, setForm] = useState({
    patientName: "",
    dob: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    item: "",
    hcpcCode: "",
    diagnosis: "",
    insurance: "",
  });
  const [shipTo, setShipTo] = useState<"patient" | "doctor" | "other">("patient");
  const [shipToOther, setShipToOther] = useState("");
  const [shipToDropdownOpen, setShipToDropdownOpen] = useState(false);
  const [certified, setCertified] = useState(true);
  const [dobDate, setDobDate] = useState<Date | undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orgItems, setOrgItems] = useState<OrgItem[]>([]);
  const [orgInsurances, setOrgInsurances] = useState<OrgInsurance[]>([]);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [insuranceDropdownOpen, setInsuranceDropdownOpen] = useState(false);
  const [isOtherItem, setIsOtherItem] = useState(false);
  const [createDocOpen, setCreateDocOpen] = useState(false);

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
    const fetchInsurances = async () => {
      const { data } = await supabase
        .from("org_insurances" as any)
        .select("id, name")
        .eq("organization_id", currentOrg.id)
        .order("name");
      setOrgInsurances((data as unknown as OrgInsurance[]) || []);
    };
    fetchItems();
    fetchInsurances();
  }, [isOpen, currentOrg?.id]);

  if (!isOpen) return null;

  const handleDateSelect = (date: Date | undefined) => {
    setDobDate(date);
    if (date) {
      setForm((p) => ({ ...p, dob: format(date, "MM/dd/yyyy") }));
    }
  };

  const autoFormatDate = (value: string) => {
    const digits = value.replace(/\D/g, "");
    let formatted = "";
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
    return formatted;
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
    
    const sanitize = (s: string) => s.replace(/[<>{}]/g, '').trim();
    const sanitizedForm = {
      patientName: sanitize(form.patientName),
      dob: form.dob,
      phone: sanitize(form.phone),
      address: [sanitize(form.address), sanitize(form.city), sanitize(form.state), sanitize(form.zip)].filter(Boolean).join(", "),
      item: sanitize(form.item),
      hcpcCode: sanitize(form.hcpcCode),
      diagnosis: sanitize(form.diagnosis),
      insurance: sanitize(form.insurance),
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
        uploadedDocs.push({ name: file.name, url: filePath });
      }
      
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (shipTo === "other" && !shipToOther.trim()) {
      toast({ title: "Validation Error", description: "Please enter the shipping address.", variant: "destructive" });
      setUploading(false);
      return;
    }

    onSubmit({ ...sanitizedForm, shipTo, shipToOther: shipTo === "other" ? shipToOther.trim() : undefined, documents: uploadedDocs });
    setForm({ patientName: "", dob: "", phone: "", address: "", city: "", state: "", zip: "", item: "", hcpcCode: "", diagnosis: "", insurance: "" });
    setShipTo("patient");
    setShipToOther("");
    setIsOtherItem(false);
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
        <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Submit New Patient</h2>
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.dob}
                      onChange={(e) => {
                        const formatted = autoFormatDate(e.target.value);
                        setForm((p) => ({ ...p, dob: formatted }));
                        if (formatted.length === 10) {
                          const parsed = new Date(formatted);
                          if (!isNaN(parsed.getTime()) && parsed < new Date()) {
                            setDobDate(parsed);
                          } else {
                            setDobDate(undefined);
                          }
                        } else {
                          setDobDate(undefined);
                        }
                      }}
                      placeholder="MM/DD/YYYY"
                      maxLength={10}
                      required
                      className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0 border-input"
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[60]" align="end">
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
                  </div>
                </div>
                <Field label="Phone No" value={form.phone} onChange={set("phone")} required placeholder="(555) 000-0000" />
                <Field label="Address" value={form.address} onChange={set("address")} required placeholder="123 Main St" />
                <Field label="City" value={form.city} onChange={set("city")} required placeholder="City" />
                <Field label="State" value={form.state} onChange={set("state")} required placeholder="State" />
                <Field label="Zip Code" value={form.zip} onChange={set("zip")} required placeholder="ZIP" />
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
                {/* Item dropdown */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Item <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setItemDropdownOpen(!itemDropdownOpen)}
                      className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                    >
                      <span className={form.item || isOtherItem ? "text-foreground" : "text-muted-foreground/60"}>
                        {isOtherItem ? "Other" : form.item || "Select item"}
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
                                setForm((p) => ({ ...p, item: item.name }));
                                setIsOtherItem(false);
                                setItemDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                                form.item === item.name && !isOtherItem ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setForm((p) => ({ ...p, item: "" }));
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
                      value={form.item}
                      onChange={(e) => setForm((p) => ({ ...p, item: e.target.value }))}
                      placeholder="Enter product name"
                      required
                      className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                    />
                  )}
                  {/* Hidden required input for form validation */}
                  <input type="text" value={form.item} required className="sr-only" tabIndex={-1} onChange={() => {}} />
                </div>
                <Field label="HCPC Code" value={form.hcpcCode} onChange={set("hcpcCode")} required placeholder="e.g. E0100" />
                <Field label="Diagnosis" value={form.diagnosis} onChange={set("diagnosis")} required placeholder="e.g. M17.11" />

                {/* Insurance dropdown */}
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Insurance <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setInsuranceDropdownOpen(!insuranceDropdownOpen)}
                      className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                    >
                      <span className={form.insurance ? "text-foreground" : "text-muted-foreground/60"}>
                        {form.insurance || "Select insurance"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {insuranceDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setInsuranceDropdownOpen(false)} />
                        <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                          {orgInsurances.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
                              No insurances configured by your admin
                            </div>
                          ) : (
                            orgInsurances.map((ins) => (
                              <button
                                key={ins.id}
                                type="button"
                                onClick={() => {
                                  setForm((p) => ({ ...p, insurance: ins.name }));
                                  setInsuranceDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                                  form.insurance === ins.name ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                                }`}
                              >
                                {ins.name}
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Hidden required input for form validation */}
                  <input type="text" value={form.insurance} required className="sr-only" tabIndex={-1} onChange={() => {}} />
                </div>

                {/* Ship To dropdown */}
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Ship To <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShipToDropdownOpen(!shipToDropdownOpen)}
                      className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                    >
                      <span className="text-foreground">
                        {shipTo === "patient" ? "Patient Address" : shipTo === "doctor" ? "Doctor's Address" : "Other"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {shipToDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShipToDropdownOpen(false)} />
                        <div className="absolute top-full left-0 right-0 z-20 mt-1 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                          {[
                            { value: "patient" as const, label: "Patient Address" },
                            { value: "doctor" as const, label: "Doctor's Address" },
                            { value: "other" as const, label: "Other" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setShipTo(opt.value);
                                setShipToDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                                shipTo === opt.value ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {shipTo === "other" && (
                    <input
                      type="text"
                      value={shipToOther}
                      onChange={(e) => setShipToOther(e.target.value)}
                      placeholder="Enter shipping address"
                      required
                      className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                    />
                  )}
                </div>
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

              {/* Create Document button */}
              <button
                type="button"
                onClick={() => setCreateDocOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary w-full justify-center"
              >
                <FilePlus className="h-4 w-4" />
                Create Document
              </button>

              <CreateDocumentModal
                isOpen={createDocOpen}
                onClose={() => setCreateDocOpen(false)}
                onDocumentCreated={(file) => {
                  setFiles((prev) => [...prev, file]);
                }}
                patientName={form.patientName}
                dob={form.dob}
                phone={form.phone}
                address={[form.address, form.city, form.state, form.zip].filter(Boolean).join(", ")}
              />
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

            {/* Certification */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary accent-primary shrink-0"
                required
              />
              <label className="text-xs text-muted-foreground leading-relaxed cursor-pointer" onClick={() => setCertified(!certified)}>
                I certify that the prescribed medical equipment is/are medically necessary for the patient's health and well being. In my expert opinion, as their medical doctor, the medical equipment is/are reasonable and necessary part(s) of the treatment of patient care and rehabilitation.
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading || !form.patientName || !form.dob || !form.phone || !form.address || !form.city || !form.state || !form.zip || !form.item || !form.diagnosis || !certified}
                className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Submit Patient"
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
