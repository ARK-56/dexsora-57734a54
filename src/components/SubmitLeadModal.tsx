import { useState } from "react";
import { X } from "lucide-react";

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
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
    setForm({ patientName: "", dob: "", phone: "", email: "", address: "", medicareId: "", ppoId: "" });
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
              <Field label="Date of Birth" value={form.dob} onChange={set("dob")} placeholder="MM/DD/YYYY" required />
              <Field label="Phone" value={form.phone} onChange={set("phone")} />
              <Field label="Email" value={form.email} onChange={set("email")} type="email" />
              <Field label="Medicare ID" value={form.medicareId} onChange={set("medicareId")} required />
              <Field label="PPO ID" value={form.ppoId} onChange={set("ppoId")} />
            </div>
            <Field label="Full Address" value={form.address} onChange={set("address")} required />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground shadow-sm transition-all hover:opacity-90">
                ➕ Submit Lead
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
