import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, code, new_password } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "send_code") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up user by email
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const user = usersData?.users?.find((u: any) => u.email === email);
      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Clean up old codes for this user
      await supabaseAdmin
        .from("login_verifications")
        .delete()
        .eq("user_id", user.id);

      const verificationCode = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertError } = await supabaseAdmin
        .from("login_verifications")
        .insert({ user_id: user.id, code: verificationCode, expires_at: expiresAt });

      if (insertError) throw insertError;

      // Send code via Resend
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,hsl(183,60%,20%),hsl(183,100%,25%));padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Dexsora</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;font-weight:600;">Password Change Verification</h2>
          <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
            Enter this code to confirm your password change. It expires in 10 minutes.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <div style="display:inline-block;background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b;">${verificationCode}</div>
          </td></tr></table>
          <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">
            If you didn't request a password change, please secure your account immediately.
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

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Dexsora <noreply@dexsora.com>",
          to: [email],
          subject: "Your Dexsora password change code",
          html: htmlContent,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        console.error("Resend error:", result);
        throw new Error("Failed to send verification email");
      }

      return new Response(JSON.stringify({ message: "Code sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_and_change") {
      if (!email || !code || !new_password) {
        return new Response(JSON.stringify({ error: "Email, code, and new password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new_password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up user
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const user = usersData?.users?.find((u: any) => u.email === email);
      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check code
      const { data: verification, error: fetchError } = await supabaseAdmin
        .from("login_verifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("code", code)
        .eq("verified", false)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!verification) {
        return new Response(JSON.stringify({ error: "Invalid code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(verification.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Code has expired. Please request a new one." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update password via admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: new_password,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update password" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Clean up verification codes
      await supabaseAdmin
        .from("login_verifications")
        .delete()
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("change-password error:", error.message);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
