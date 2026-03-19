import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
const isValidNPI = (npi: string) => /^\d{10}$/.test(npi);
const VALID_ORG_ROLES = ["doctor", "eligibility", "auth_team", "shipment", "billing", "logistics"];

async function sendOrgInviteEmail(email: string, orgName: string, role: string, setupUrl: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Dexsora</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;font-weight:600;">You're Invited to ${orgName}!</h2>
          <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
            You've been invited to join <strong style="color:#18181b;">${orgName}</strong> on Dexsora as a <strong style="color:#18181b;">${role}</strong>. Click below to set up your account.
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Dexsora <noreply@dexsora.com>",
        to: [email],
        subject: `You're invited to join ${orgName} on Dexsora`,
        html,
      }),
    });
    const resBody = await res.json();
    if (!res.ok) {
      console.error("Resend API error:", JSON.stringify(resBody));
    } else {
      console.log("Org invite email sent successfully to:", email);
    }
  } catch (e) {
    console.error("Failed to send org invite email:", e);
  }
}

function getSetupBaseUrl() {
  return "https://dexsora.com";
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

    const { action, ...payload } = await req.json();

    if (action === "invite_member") {
      const { email, role, organizationId, npi } = payload;
      if (!email || !organizationId) throw new Error("Missing required fields");
      if (!isValidEmail(email)) throw new Error("Invalid email format");
      if (!VALID_ORG_ROLES.includes(role)) throw new Error("Invalid role");
      if (npi && !isValidNPI(npi)) throw new Error("NPI must be exactly 10 digits");

      // Verify caller is org admin/owner OR a logistics (marketing) member
      const { data: isOwner } = await supabaseAdmin.rpc("is_org_owner", {
        _user_id: caller.id,
        _organization_id: organizationId,
      });
      const { data: isOrgAdmin } = await supabaseAdmin.rpc("is_org_admin", {
        _user_id: caller.id,
        _organization_id: organizationId,
      });

      // Check if caller is a logistics (marketing) member of this org
      const { data: callerMembership } = await supabaseAdmin
        .from("org_members")
        .select("role")
        .eq("user_id", caller.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      const isLogisticsMember = callerMembership?.role === "logistics";

      if (!isOwner && !isOrgAdmin && !isLogisticsMember) throw new Error("Only org admins can invite members");

      // Logistics (marketing) members can ONLY invite doctor role
      if (isLogisticsMember && !isOwner && !isOrgAdmin && role !== "doctor") {
        throw new Error("Marketing members can only invite Doctor/Facility members");
      }

      // Get org name
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();
      if (!org) throw new Error("Organization not found");

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

      if (existingUser) {
        // Check if already a member
        const { data: existingMember } = await supabaseAdmin
          .from("org_members")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (existingMember) throw new Error("This user is already a member of this organization");

        // Add existing user to org
        const { error: memberError } = await supabaseAdmin
          .from("org_members")
          .insert({ user_id: existingUser.id, organization_id: organizationId, role, invited_by: caller.id });
        if (memberError) throw memberError;

        return new Response(
          JSON.stringify({ message: "Existing user added to organization" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new user with org metadata
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          pending_setup: true,
          assigned_role: role,
          organization_id: organizationId,
          org_role: role,
          npi: npi || "",
        },
      });
      if (createError) throw createError;

      // Add role
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });

      // Add to org_members
      await supabaseAdmin
        .from("org_members")
        .insert({ user_id: newUser.user.id, organization_id: organizationId, role, invited_by: caller.id });

      // Update NPI if provided
      if (npi) {
        await supabaseAdmin.from("profiles").update({ npi }).eq("user_id", newUser.user.id);
      }

      // Generate magic link
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${getSetupBaseUrl()}/setup-account` },
      });
      const setupUrl = linkData?.properties?.action_link || `${getSetupBaseUrl()}/setup-account`;

      await sendOrgInviteEmail(email, org.name, role, setupUrl);

      return new Response(
        JSON.stringify({ message: "Invitation sent", userId: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove_member") {
      const { userId, organizationId } = payload;
      if (!userId || !organizationId) throw new Error("Missing required fields");

      // Verify caller is org admin/owner
      const { data: isOwner } = await supabaseAdmin.rpc("is_org_owner", {
        _user_id: caller.id,
        _organization_id: organizationId,
      });
      if (!isOwner) throw new Error("Only org owners can remove members");
      if (userId === caller.id) throw new Error("Cannot remove yourself");

      const { error } = await supabaseAdmin
        .from("org_members")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", organizationId);
      if (error) throw error;

      return new Response(
        JSON.stringify({ message: "Member removed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list_members") {
      const { organizationId } = payload;
      if (!organizationId) throw new Error("Missing organizationId");

      // Verify caller belongs to org
      const { data: belongs } = await supabaseAdmin.rpc("user_belongs_to_org", {
        _user_id: caller.id,
        _organization_id: organizationId,
      });
      if (!belongs) throw new Error("Not a member of this organization");

      // Check if caller is a logistics (marketing) member
      const { data: callerMembership } = await supabaseAdmin
        .from("org_members")
        .select("role")
        .eq("user_id", caller.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      const callerIsLogistics = callerMembership?.role === "logistics";

      // Check if caller is also org admin/owner
      const { data: callerIsAdmin } = await supabaseAdmin.rpc("is_org_admin", {
        _user_id: caller.id,
        _organization_id: organizationId,
      });

      let membersQuery = supabaseAdmin
        .from("org_members")
        .select("user_id, role, created_at, invited_by")
        .eq("organization_id", organizationId);

      // If logistics member (and NOT also an admin/owner), only show members they invited + themselves
      if (callerIsLogistics && !callerIsAdmin) {
        membersQuery = membersQuery.or(`invited_by.eq.${caller.id},user_id.eq.${caller.id}`);
      }

      const { data: members, error } = await membersQuery;
      if (error) throw error;

      // Get profiles for members
      const userIds = (members || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, email, npi")
        .in("user_id", userIds);

      // Get pending_setup status from auth users
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
      const userMetaMap = new Map<string, boolean>();
      (allUsers?.users || []).forEach((u: any) => {
        userMetaMap.set(u.id, !!u.user_metadata?.pending_setup);
      });

      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("owner_id")
        .eq("id", organizationId)
        .single();

      const enriched = (members || []).map((m: any) => {
        const profile = (profiles || []).find((p: any) => p.user_id === m.user_id);
        return {
          ...m,
          full_name: profile?.full_name || null,
          email: profile?.email || null,
          npi: profile?.npi || null,
          is_owner: org?.owner_id === m.user_id,
          pending_setup: userMetaMap.get(m.user_id) ?? false,
        };
      });

      return new Response(
        JSON.stringify({ members: enriched }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "resend_invite") {
      const { userId, organizationId } = payload;
      if (!userId || !organizationId) throw new Error("Missing required fields");

      const { data: isOwner } = await supabaseAdmin.rpc("is_org_owner", {
        _user_id: caller.id, _organization_id: organizationId,
      });
      const { data: isOrgAdminRes } = await supabaseAdmin.rpc("is_org_admin", {
        _user_id: caller.id, _organization_id: organizationId,
      });
      if (!isOwner && !isOrgAdminRes) throw new Error("Only org admins can resend invites");

      const { data: targetUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userErr || !targetUser?.user) throw new Error("User not found");
      if (!targetUser.user.user_metadata?.pending_setup) throw new Error("This user has already completed setup");

      const email = targetUser.user.email!;
      const { data: org } = await supabaseAdmin
        .from("organizations").select("name").eq("id", organizationId).single();
      if (!org) throw new Error("Organization not found");

      const { data: membership } = await supabaseAdmin
        .from("org_members").select("role").eq("user_id", userId).eq("organization_id", organizationId).maybeSingle();
      const role = membership?.role || "doctor";

      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink", email,
        options: { redirectTo: `${getSetupBaseUrl()}/setup-account` },
      });
      const setupUrl = linkData?.properties?.action_link || `${getSetupBaseUrl()}/setup-account`;
      await sendOrgInviteEmail(email, org.name, role, setupUrl);

      return new Response(
        JSON.stringify({ message: "Invitation resent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list_invited_user_ids") {
      const { organizationId } = payload;
      if (!organizationId) throw new Error("Missing organizationId");

      const { data: members, error } = await supabaseAdmin
        .from("org_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("invited_by", caller.id);
      if (error) throw error;

      const userIds = (members || []).map((m: any) => m.user_id);

      return new Response(
        JSON.stringify({ userIds }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Unknown action");
  } catch (error) {
    console.error("manage-org-members error:", error.message);
    const msg = error.message?.toLowerCase() || "";
    let safeMessage = "Unable to complete request. Please try again.";
    if (msg.includes("missing")) safeMessage = error.message;
    else if (msg.includes("invalid")) safeMessage = error.message;
    else if (msg.includes("only org")) safeMessage = error.message;
    else if (msg.includes("marketing members")) safeMessage = error.message;
    else if (msg.includes("already")) safeMessage = error.message;
    else if (msg.includes("cannot")) safeMessage = error.message;
    else if (msg.includes("not a member")) safeMessage = error.message;
    else if (msg.includes("unauthorized")) safeMessage = "Unauthorized";

    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
