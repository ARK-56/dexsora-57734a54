import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import {
  ArrowLeft, Building2, Users, CreditCard, Activity,
  Search, ChevronLeft, ChevronRight, X,
} from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  plan_type: string;
  is_active: boolean;
  owner_id: string;
  created_at: string;
  stripe_customer_id: string | null;
  address: string | null;
  phone: string | null;
}

interface SubRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  plan_type: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  npi: string | null;
  created_at: string;
}

interface RoleRow {
  user_id: string;
  role: string;
}

interface OrgMemberRow {
  user_id: string;
  organization_id: string;
  role: string;
}

const formatRole = (role: string) =>
  role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const PER_PAGE = 15;

const SuperAdminDashboard = () => {
  const { isSuperAdmin, loading: authLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "orgs" | "subs">("overview");
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userRoles, setUserRoles] = useState<RoleRow[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrg, setSelectedOrg] = useState<OrgRow | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchAll = async () => {
      const [orgsRes, subsRes, profilesRes, rolesRes, membersRes] = await Promise.all([
        supabase.from("organizations").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name, email, npi, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("org_members").select("user_id, organization_id, role"),
      ]);
      if (orgsRes.data) setOrgs(orgsRes.data as OrgRow[]);
      if (subsRes.data) setSubs(subsRes.data as SubRow[]);
      if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
      if (rolesRes.data) setUserRoles(rolesRes.data);
      if (membersRes.data) setOrgMembers(membersRes.data as OrgMemberRow[]);
      setLoadingData(false);
    };
    fetchAll();
  }, [isSuperAdmin]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) return <Navigate to="/" replace />;

  const getUserRoles = (userId: string) => userRoles.filter((r) => r.user_id === userId).map((r) => r.role);
  const getOrgName = (orgId: string | null) => orgs.find((o) => o.id === orgId)?.name || "—";
  const getOwnerEmail = (ownerId: string) => profiles.find((p) => p.user_id === ownerId)?.email || "—";
  const getMemberCount = (orgId: string) => orgMembers.filter((m) => m.organization_id === orgId).length;

  const activeOrgs = orgs.filter((o) => o.is_active).length;
  const activeSubs = subs.filter((s) => s.status === "active").length;
  const totalUsers = profiles.length;
  const totalDoctors = userRoles.filter((r) => r.role === "doctor").length;

  const paginate = <T,>(items: T[]) => {
    const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
    const currentPage = Math.min(page, totalPages);
    return {
      items: items.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
      totalPages,
      currentPage,
      total: items.length,
    };
  };

  const Pagination = ({ totalPages, currentPage, total }: { totalPages: number; currentPage: number; total: number }) =>
    totalPages > 1 ? (
      <div className="flex items-center justify-between px-1 pt-3">
        <p className="text-sm text-muted-foreground">
          {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, total)} of {total}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    ) : null;

  const StatusDot = ({ active }: { active: boolean }) => (
    <span className={`inline-block h-2 w-2 rounded-full ${active ? "bg-green-500" : "bg-muted-foreground/40"}`} />
  );

  // Org detail drawer
  const getOrgMembers = (orgId: string) => {
    return orgMembers
      .filter((m) => m.organization_id === orgId)
      .map((m) => {
        const profile = profiles.find((p) => p.user_id === m.user_id);
        return { ...m, full_name: profile?.full_name || "—", email: profile?.email || "—", npi: profile?.npi || null };
      });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Platform-wide monitoring</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Building2, label: "Active Orgs", value: activeOrgs, total: orgs.length },
            { icon: CreditCard, label: "Active Subs", value: activeSubs, total: subs.length },
            { icon: Users, label: "Total Users", value: totalUsers },
            { icon: Activity, label: "Doctors", value: totalDoctors },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl swoosh-gradient p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-white">
                  {s.value}{s.total !== undefined ? <span className="text-sm font-normal text-white/60"> / {s.total}</span> : null}
                </p>
                <p className="text-xs text-white/80">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs - removed Users tab */}
        <div className="flex gap-1 border-b border-border">
          {([
            { key: "overview" as const, label: "Overview" },
            { key: "orgs" as const, label: `Organizations (${orgs.length})` },
            { key: "subs" as const, label: `Subscriptions (${subs.length})` },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); setSearch(""); }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Overview */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-6 py-4">
                    <h3 className="text-sm font-semibold text-foreground">Recent Organizations</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {orgs.slice(0, 5).map((org) => (
                      <div key={org.id} className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedOrg(org)}>
                        <div>
                          <p className="text-sm font-semibold text-primary flex items-center gap-2 hover:underline">
                            <StatusDot active={org.is_active} />
                            {org.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{getOwnerEmail(org.owner_id)}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {org.plan_type}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">{getMemberCount(org.id)} members</p>
                        </div>
                      </div>
                    ))}
                    {orgs.length === 0 && <div className="py-8 text-center text-muted-foreground">No organizations yet.</div>}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-6 py-4">
                    <h3 className="text-sm font-semibold text-foreground">Recent Subscriptions</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {subs.slice(0, 5).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between px-6 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <StatusDot active={sub.status === "active"} />
                            {getOrgName(sub.organization_id)}
                          </p>
                          <p className="text-xs text-muted-foreground">{sub.plan_type}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            sub.status === "active"
                              ? "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                              : "border border-border bg-muted text-muted-foreground"
                          }`}>
                            {sub.status}
                          </span>
                          {sub.current_period_end && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ends {new Date(sub.current_period_end).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {subs.length === 0 && <div className="py-8 text-center text-muted-foreground">No subscriptions yet.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Organizations Tab */}
            {activeTab === "orgs" && (() => {
              const searchLower = search.toLowerCase();
              const filtered = orgs.filter((o) =>
                !search || o.name.toLowerCase().includes(searchLower) || getOwnerEmail(o.owner_id).toLowerCase().includes(searchLower)
              );
              const { items, totalPages, currentPage, total } = paginate(filtered);
              return (
                <div className="space-y-3">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search organizations..." className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((org) => (
                          <tr key={org.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedOrg(org)}>
                            <td className="px-5 py-3.5">
                              <p className="text-sm font-semibold text-primary hover:underline">{org.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{org.id.slice(0, 8)}…</p>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-muted-foreground">{getOwnerEmail(org.owner_id)}</td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{org.plan_type}</span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-foreground">{getMemberCount(org.id)}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                org.is_active
                                  ? "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                                  : "border border-border bg-muted text-muted-foreground"
                              }`}>
                                <StatusDot active={org.is_active} />
                                {org.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {items.length === 0 && <div className="py-12 text-center text-muted-foreground">No organizations found.</div>}
                  </div>
                  <Pagination totalPages={totalPages} currentPage={currentPage} total={total} />
                </div>
              );
            })()}

            {/* Subscriptions Tab */}
            {activeTab === "subs" && (() => {
              const searchLower = search.toLowerCase();
              const filtered = subs.filter((s) =>
                !search || s.plan_type.toLowerCase().includes(searchLower) || s.status.toLowerCase().includes(searchLower) || getOrgName(s.organization_id).toLowerCase().includes(searchLower)
              );
              const { items, totalPages, currentPage, total } = paginate(filtered);
              return (
                <div className="space-y-3">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search subscriptions..." className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period End</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auto-Renew</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stripe ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((sub) => (
                          <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3.5 text-sm font-semibold text-foreground">{getOrgName(sub.organization_id)}</td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{sub.plan_type}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                sub.status === "active"
                                  ? "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                                  : sub.status === "canceled"
                                  ? "border border-destructive/30 bg-destructive/10 text-destructive"
                                  : "border border-border bg-muted text-muted-foreground"
                              }`}>
                                {sub.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-muted-foreground">
                              {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-sm text-muted-foreground">
                              {sub.cancel_at_period_end ? "No" : "Yes"}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono">
                              {sub.stripe_subscription_id ? sub.stripe_subscription_id.slice(0, 20) + "…" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {items.length === 0 && <div className="py-12 text-center text-muted-foreground">No subscriptions found.</div>}
                  </div>
                  <Pagination totalPages={totalPages} currentPage={currentPage} total={total} />
                </div>
              );
            })()}
          </>
        )}
      </main>

      {/* Organization Detail Drawer */}
      {selectedOrg && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" onClick={() => setSelectedOrg(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-border bg-card shadow-2xl animate-fade-in overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-border bg-card">
              <div className="swoosh-gradient px-5 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary-foreground" />
                    <h2 className="font-display text-lg font-bold text-primary-foreground">{selectedOrg.name}</h2>
                  </div>
                  <button onClick={() => setSelectedOrg(null)} className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20">
                    <X className="h-4 w-4 text-primary-foreground" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Org Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization Details</h3>
                <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Plan</p>
                      <p className="font-medium text-foreground">{selectedOrg.plan_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-medium text-foreground">{selectedOrg.is_active ? "Active" : "Inactive"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Owner</p>
                      <p className="font-medium text-foreground">{getOwnerEmail(selectedOrg.owner_id)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-medium text-foreground">{new Date(selectedOrg.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="font-medium text-foreground">{selectedOrg.address || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-foreground">{selectedOrg.phone || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Members ({getOrgMembers(selectedOrg.id).length})
                </h3>
                <div className="space-y-2">
                  {getOrgMembers(selectedOrg.id).map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.npi && (
                          <span className="text-xs text-muted-foreground">NPI: {member.npi}</span>
                        )}
                        <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {formatRole(member.role)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {getOrgMembers(selectedOrg.id).length === 0 && (
                    <p className="text-sm text-muted-foreground italic text-center py-4">No members found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
