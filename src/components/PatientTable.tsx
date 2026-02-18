import { DbLead } from "@/hooks/useLeads";
import { StatusBadge } from "./StatusBadge";
import { Star, ClipboardList, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { LeadStatus } from "@/types/lead";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 10;

// For doctor view: statuses beyond Shipped show as "Shipped"
const DOCTOR_HIDDEN_STATUSES = ["Auth Applied", "Auth Approved", "Pre Payment Request", "Post Payment Request", "Billed", "Paid"];
const getDoctorDisplayStatus = (status: string, isAdmin: boolean): LeadStatus => {
  if (isAdmin) return status as LeadStatus;
  if (DOCTOR_HIDDEN_STATUSES.includes(status)) return "Shipped";
  return status as LeadStatus;
};

interface PatientTableProps {
  leads: DbLead[];
  onSelectLead: (lead: DbLead) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

interface LeadNote {
  id: string;
  text: string;
  author: string;
  created_at: string;
  is_read: boolean;
}

const NotesPopup = ({ leadId, patientName, onClose, onUnreadChange }: { leadId: string; patientName: string; onClose: () => void; onUnreadChange?: (delta: number) => void }) => {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      const { data } = await supabase
        .from("lead_notes")
        .select("id, text, author, created_at, is_read")
        .eq("lead_id", leadId)
        .eq("is_internal", false)
        .order("created_at", { ascending: false });
      setNotes((data as LeadNote[]) || []);
      setLoading(false);
    };
    fetchNotes();
  }, [leadId]);

  const markAsRead = async (noteId: string) => {
    await supabase.from("lead_notes").update({ is_read: true }).eq("id", noteId);
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, is_read: true } : n)));
    onUnreadChange?.(-1);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60]" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-80 rounded-lg border border-border bg-card shadow-xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs font-semibold text-foreground truncate">Notes for {patientName}</p>
          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="max-h-60 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className={`rounded-md border p-2 text-xs ${note.is_read ? "border-border bg-muted/20" : "border-primary/30 bg-primary/5"}`}>
                <p className="text-foreground">{note.text}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-muted-foreground">{note.author} · {new Date(note.created_at).toLocaleDateString()}</span>
                  {!note.is_read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(note.id); }}
                      className="text-[10px] font-medium text-primary hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

const NotesIconButton = ({ leadId, patientName }: { leadId: string; patientName: string }) => {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("lead_notes")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId)
        .eq("is_internal", false)
        .eq("is_read", false);
      setUnreadCount(count || 0);
    };
    fetchCount();
  }, [leadId]);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-muted-foreground hover:text-primary transition-colors relative"
        title="View notes"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>
      {open && <NotesPopup leadId={leadId} patientName={patientName} onClose={() => { setOpen(false); }} onUnreadChange={(delta) => setUnreadCount((c) => Math.max(0, c + delta))} />}
    </div>
  );
};

export const PatientTable = ({ leads, onSelectLead, selectedIds, onToggleSelect, onToggleAll, allSelected }: PatientTableProps) => {
  const [page, setPage] = useState(0);
  const { hasAdminAccess } = useAuth();
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const safeePage = Math.min(page, totalPages - 1);
  const pagedLeads = leads.slice(safeePage * PAGE_SIZE, (safeePage + 1) * PAGE_SIZE);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="swoosh-gradient">
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary rounded"
                    checked={allSelected && leads.length > 0}
                    onChange={onToggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Patient</th>
                <th className="w-20 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Status</th>
                {hasAdminAccess && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Doctor</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Order Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Docs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedLeads.map((lead, idx) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={`cursor-pointer transition-colors hover:bg-accent/40 ${
                    idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                  } ${selectedIds.includes(lead.id) ? "!bg-primary/10 ring-1 ring-inset ring-primary/20" : ""}`}
                >
                  <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary rounded"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => onToggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap max-w-[200px]">
                    <div className="flex items-center gap-1.5 relative">
                      <span className="truncate">{lead.patient_name}</span>
                      <NotesIconButton leadId={lead.id} patientName={lead.patient_name} />
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Star className="h-4 w-4 hover:text-warning cursor-pointer transition-colors" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead);
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title={lead.documents.length > 0 ? `View ${lead.documents.length} document(s)` : "No documents yet"}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={getDoctorDisplayStatus(lead.status, hasAdminAccess)} />
                  </td>
                  {hasAdminAccess && (
                    <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">
                      <div>
                        <p className="font-medium">{lead.doctor_name || "—"}</p>
                        {lead.doctor_npi && <p className="text-muted-foreground">NPI: {lead.doctor_npi}</p>}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                    {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5 text-foreground whitespace-nowrap text-xs">
                    {lead.item || lead.dme_items || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                    {lead.documents.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
                        {lead.documents.length} file{lead.documents.length > 1 ? "s" : ""}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                    {new Date(lead.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Showing {safeePage * PAGE_SIZE + 1}–{Math.min((safeePage + 1) * PAGE_SIZE, leads.length)} of {leads.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safeePage === 0}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  i === safeePage
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safeePage >= totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelectLead(lead)}
            className="status-card-enter cursor-pointer rounded-lg border border-border bg-card p-4 transition-all active:shadow-md hover:border-primary/30"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selectedIds.includes(lead.id)}
                  onChange={(e) => { e.stopPropagation(); onToggleSelect(lead.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-foreground">{lead.patient_name}</p>
                  <NotesIconButton leadId={lead.id} patientName={lead.patient_name} />
                  <p className="text-xs text-muted-foreground mt-0.5">DOB: {lead.dob}</p>
                </div>
              </div>
              <StatusBadge status={getDoctorDisplayStatus(lead.status, hasAdminAccess)} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 border-t border-border pt-2">
              <span>Order Date: {new Date(lead.created_at).toLocaleDateString()}</span>
              {(lead.item || lead.dme_items) && <span className="font-medium text-foreground">{lead.item || lead.dme_items}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
