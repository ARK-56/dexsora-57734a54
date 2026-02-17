import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation helpers
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
const isValidName = (name: string) => name.length > 0 && name.length <= 100 && !/[<>{}]/.test(name);
const isValidNPI = (npi: string) => /^\d{10}$/.test(npi);
const isValidPassword = (pw: string) => pw.length >= 8 && pw.length <= 128;
const VALID_STAFF_ROLES = ["eligibility", "shipment", "billing"];
const VALID_ALL_ROLES = ["admin", "doctor", "eligibility", "auth_team", "shipment", "billing"];

// Audit log helper
async function logAudit(
  supabaseAdmin: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, any> = {}
) {
  try {
    await supabaseAdmin.rpc("insert_audit_log", {
      _user_id: userId,
      _action: action,
      _entity_type: entityType,
      _entity_id: entityId,
      _details: details,
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error("Unauthorized");

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isAdmin = callerRoles?.some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can manage users");

    const { action, ...payload } = await req.json();

    // Invite-based user creation (email only)
    if (action === "invite_user") {
      const { email, role } = payload;
      if (!email) throw new Error("Missing email");
      if (!isValidEmail(email)) throw new Error("Invalid email format");
      if (!VALID_STAFF_ROLES.includes(role)) throw new Error("Invalid role. Must be one of: " + VALID_STAFF_ROLES.join(", "));

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
      if (existingUser) throw new Error("A user with this email already exists. Use the edit function to update their role.");

      // Use inviteUserByEmail to create user AND send the invite email
      const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { pending_setup: true, assigned_role: role },
        redirectTo: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || ''}/setup-account`,
      });

      if (inviteError) throw inviteError;

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });
      if (roleError) throw roleError;

      await logAudit(supabaseAdmin, caller.id, "invite_user", "user", newUser.user.id, { email, role });

      return new Response(
        JSON.stringify({ message: "Invitation sent", userId: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "invite_doctor") {
      const { email, npi } = payload;
      if (!email) throw new Error("Missing email");
      if (!isValidEmail(email)) throw new Error("Invalid email format");
      if (npi && !isValidNPI(npi)) throw new Error("NPI must be exactly 10 digits");

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
      if (existingUser) throw new Error("A user with this email already exists. Use the edit function to update their role.");

      // Use inviteUserByEmail to create user AND send the invite email
      const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { pending_setup: true, assigned_role: "doctor", npi: npi || "" },
        redirectTo: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || ''}/setup-account`,
      });

      if (inviteError) throw inviteError;

      // Assign doctor role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "doctor" });
      if (roleError) throw roleError;

      // Update NPI on profile if provided
      if (npi) {
        await supabaseAdmin.from("profiles").update({ npi }).eq("user_id", newUser.user.id);
      }

      await logAudit(supabaseAdmin, caller.id, "invite_doctor", "user", newUser.user.id, { email, npi });

      return new Response(
        JSON.stringify({ message: "Doctor invitation sent", userId: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const { userId, fullName, email, role, password } = payload;
      if (!userId) throw new Error("Missing userId");

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format");
      }

      if (fullName !== undefined && !isValidName(fullName)) throw new Error("Invalid name format");
      if (email !== undefined && !isValidEmail(email)) throw new Error("Invalid email format");
      if (role && !VALID_ALL_ROLES.includes(role)) throw new Error("Invalid role");
      if (password !== undefined && !isValidPassword(password)) throw new Error("Password must be 8-128 characters");

      if (userId === caller.id && role && role !== "admin") {
        throw new Error("Cannot remove your own admin role");
      }

      const changes: Record<string, any> = {};

      if (password) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
        if (pwError) throw pwError;
        changes.password_updated = true;
      }

      if (fullName !== undefined || email !== undefined) {
        const updates: any = {};
        if (fullName !== undefined) { updates.full_name = fullName; changes.full_name = fullName; }
        if (email !== undefined) { updates.email = email; changes.email = email; }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(updates)
          .eq("user_id", userId);

        if (profileError) throw profileError;
      }

      if (role) {
        const { data: oldRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
        changes.old_role = oldRoles?.[0]?.role;
        changes.new_role = role;

        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role });

        if (roleError) throw roleError;
      }

      await logAudit(supabaseAdmin, caller.id, "update_user", "user", userId, changes);

      return new Response(
        JSON.stringify({ message: "User updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete user action
    if (action === "delete_user") {
      const { userId } = payload;
      if (!userId) throw new Error("Missing userId");

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format");
      }

      // Prevent self-deletion
      if (userId === caller.id) {
        throw new Error("Cannot delete your own account");
      }

      // Get user info for audit before deletion
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", userId)
        .single();

      // Delete roles first
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

      // Delete profile
      await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

      // Delete auth user
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      await logAudit(supabaseAdmin, caller.id, "delete_user", "user", userId, {
        email: userProfile?.email,
        full_name: userProfile?.full_name,
      });

      return new Response(
        JSON.stringify({ message: "User deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Unknown action");
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
