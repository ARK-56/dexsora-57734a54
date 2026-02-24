import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ADMIN_ACCESS_ROLES: AppRole[] = ["admin", "eligibility", "auth_team", "shipment", "billing"];

interface AuthContextType {
  user: User | null;
  profile: { full_name: string | null; email: string | null; avatar_url: string | null; npi: string | null } | null;
  roles: AppRole[];
  isAdmin: boolean;
  hasAdminAccess: boolean;
  isDoctor: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null; avatar_url: string | null; npi: string | null } | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email, avatar_url, npi").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (rolesRes.data) setRoles(rolesRes.data.map((r) => r.role));
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const isNewUser = userIdRef.current !== session.user.id;
        const shouldUpdateUserState = isNewUser || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY";

        // Ignore focus/token refresh auth events for the same user to prevent UI "reload" on tab switch
        if (shouldUpdateUserState) {
          setUser(session.user);
        }

        userIdRef.current = session.user.id;

        // Only fetch profile/roles when user identity actually changes or profile is explicitly updated
        if (isNewUser || event === "USER_UPDATED") {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        }
      } else {
        setUser(null);
        setProfile(null);
        setRoles([]);
        userIdRef.current = null;
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      // Avoid duplicate initial fetch if auth listener already initialized user state
      if (!userIdRef.current && session?.user) {
        setUser(session.user);
        userIdRef.current = session.user.id;
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 1-hour auto-logout timer
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

  const resetLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (user) {
      logoutTimerRef.current = setTimeout(async () => {
        await supabase.auth.signOut();
      }, SESSION_TIMEOUT_MS);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      return;
    }

    resetLogoutTimer();

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => resetLogoutTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [user, resetLogoutTimer]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = roles.includes("admin");
  const hasAdminAccess = roles.some((r) => ADMIN_ACCESS_ROLES.includes(r));
  const isDoctor = roles.includes("doctor");
  const isSuperAdmin = roles.includes("super_admin");

  return (
    <AuthContext.Provider value={{ user, profile, roles, isAdmin, hasAdminAccess, isDoctor, isSuperAdmin, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
