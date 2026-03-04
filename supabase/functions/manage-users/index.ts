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

// Send branded invite email via Resend
async function sendInviteEmail(email: string, role: string, setupUrl: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured, skipping invite email");
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Dexsora</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;font-weight:600;">You're Invited!</h2>
          <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
            You've been invited to join <strong style="color:#18181b;">Dexsora</strong>. Click the button below to set up your account.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${setupUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:8px;">Set Up Your Account</a>
          </td></tr></table>
          <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${setupUrl}" style="color:#0ea5e9;word-break:break-all;">${setupUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;background-color:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">© ${new Date().getFullYear()} Dexsora. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Dexsora <noreply@dexsora.com>",
        to: [email],
        subject: "You're invited to join Dexsora",
        html: htmlContent,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
    } else {
      console.log("Invite email sent:", result.id);
    }
  } catch (e) {
    console.error("Failed to send invite email:", e);
  }
}

function getSetupBaseUrl() {
  return 'https://dexsora.com';
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

    if (action === "invite_user") {
      const { email, role } = payload;
      if (!email) throw new Error("Missing email");
      if (!isValidEmail(email)) throw new Error("Invalid email format");
      if (!VALID_STAFF_ROLES.includes(role)) throw new Error("Invalid role. Must be one of: " + VALID_STAFF_ROLES.join(", "));

      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
      if (existingUser) throw new Error("A user with this email already exists. Use the edit function to update their role.");

      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
        user_metadata: { pending_setup: true, assigned_role: role },
      });
      if (createError) throw createError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles").insert({ user_id: newUser.user.id, role });
      if (roleError) throw roleError;

      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink", email,
        options: { redirectTo: `${getSetupBaseUrl()}/setup-account` },
      });
      const setupUrl = linkData?.properties?.action_link || `${getSetupBaseUrl()}/setup-account`;

      await sendInviteEmail(email, role, setupUrl);
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

      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
      if (existingUser) throw new Error("A user with this email already exists. Use the edit function to update their role.");

      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
        user_metadata: { pending_setup: true, assigned_role: "doctor", npi: npi || "" },
      });
      if (createError) throw createError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles").insert({ user_id: newUser.user.id, role: "doctor" });
      if (roleError) throw roleError;

      if (npi) {
        await supabaseAdmin.from("profiles").update({ npi }).eq("user_id", newUser.user.id);
      }

      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink", email,
        options: { redirectTo: `${getSetupBaseUrl()}/setup-account` },
      });
      const setupUrl = linkData?.properties?.action_link || `${getSetupBaseUrl()}/setup-account`;

      await sendInviteEmail(email, "doctor", setupUrl);
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
      if (userId === caller.id && role && role !== "admin") throw new Error("Cannot remove your own admin role");

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
        const { error: profileError } = await supabaseAdmin.from("profiles").update(updates).eq("user_id", userId);
        if (profileError) throw profileError;
      }

      if (role) {
        const { data: oldRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
        changes.old_role = oldRoles?.[0]?.role;
        changes.new_role = role;
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
        if (roleError) throw roleError;
      }

      await logAudit(supabaseAdmin, caller.id, "update_user", "user", userId, changes);
      return new Response(JSON.stringify({ message: "User updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_user") {
      const { userId } = payload;
      if (!userId) throw new Error("Missing userId");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format");
      }
      if (userId === caller.id) throw new Error("Cannot delete your own account");

      const { data: userProfile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("user_id", userId).single();

      // Ban user first to immediately invalidate all active sessions/tokens
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876600h' });

      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      await logAudit(supabaseAdmin, caller.id, "delete_user", "user", userId, {
        email: userProfile?.email, full_name: userProfile?.full_name,
      });
      return new Response(JSON.stringify({ message: "User deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resend_invite") {
      const { userId } = payload;
      if (!userId) throw new Error("Missing userId");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format");
      }

      // Get user info
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError || !userData?.user) throw new Error("User not found");

      const email = userData.user.email;
      if (!email) throw new Error("User has no email");

      // Check if user still has pending_setup
      const isPending = userData.user.user_metadata?.pending_setup === true;
      if (!isPending) throw new Error("This user has already completed their account setup");

      // Get their role
      const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
      const role = roleData?.[0]?.role || "user";

      // Generate a fresh magic link
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink", email,
        options: { redirectTo: `${getSetupBaseUrl()}/setup-account` },
      });
      const setupUrl = linkData?.properties?.action_link || `${getSetupBaseUrl()}/setup-account`;

      await sendInviteEmail(email, role, setupUrl);
      await logAudit(supabaseAdmin, caller.id, "resend_invite", "user", userId, { email, role });

      return new Response(JSON.stringify({ message: "Invitation resent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const msg = error.message?.toLowerCase() || '';
    let safeMessage = 'Unable to complete request. Please try again.';
    if (msg.includes('missing')) safeMessage = error.message;
    else if (msg.includes('invalid')) safeMessage = error.message;
    else if (msg.includes('only admins')) safeMessage = 'Unauthorized access';
    else if (msg.includes('already exists')) safeMessage = 'A user with this email already exists.';
    else if (msg.includes('cannot')) safeMessage = error.message;
    else if (msg.includes('already completed')) safeMessage = error.message;
    else if (msg.includes('unknown action')) safeMessage = 'Unknown action';
    else if (msg.includes('unauthorized') || msg.includes('missing authorization')) safeMessage = 'Unauthorized';
    
    console.error('manage-users error:', error.message);
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
