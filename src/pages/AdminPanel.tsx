import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Users, Shield, Bell, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface RoleRow {
  user_id: string;
  role: string;
}

const AdminPanel = () => {
  const { isAdmin, loading } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchData = async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (rolesRes.data) setRoles(rolesRes.data);
      setLoadingData(false);
    };
    fetchData();
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const getUserRoles = (userId: string) =>
    roles.filter((r) => r.user_id === userId).map((r) => r.role);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 lg:px-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage users, roles, and system settings</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">{profiles.length}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">
                {roles.filter((r) => r.role === "admin").length}
              </p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">{roles.length}</p>
              <p className="text-xs text-muted-foreground">Role Assignments</p>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/50 px-5 py-3">
            <h2 className="font-display text-sm font-bold text-foreground">Users</h2>
          </div>
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roles</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.map((p) => (
                  <tr key={p.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-foreground">{p.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {getUserRoles(p.user_id).length > 0 ? (
                          getUserRoles(p.user_id).map((role) => (
                            <span key={role} className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
