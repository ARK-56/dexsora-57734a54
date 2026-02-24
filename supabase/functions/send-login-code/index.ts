import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { email } = await req.json();
    if (!email) throw new Error("Email is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user by email
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const user = usersData?.users?.find((u: any) => u.email === email);
    if (!user) {
      // Don't reveal if email exists or not — always say "sent"
      return new Response(JSON.stringify({ message: "If that email exists, a code was sent." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up old codes for this user
    await supabaseAdmin
      .from("login_verifications")
      .delete()
      .eq("user_id", user.id);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const { error: insertError } = await supabaseAdmin
      .from("login_verifications")
      .insert({ user_id: user.id, code, expires_at: expiresAt });

    if (insertError) throw insertError;

    // Send the code via Resend
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
          <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;font-weight:600;">Your Login Code</h2>
          <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
            Enter this code to complete your sign-in. It expires in 10 minutes.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <div style="display:inline-block;background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b;">${code}</div>
          </td></tr></table>
          <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">
            If you didn't try to log in, you can safely ignore this email or contact support if you're concerned about your account security.
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
        subject: "Your Dexsora login code",
        html: htmlContent,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      throw new Error("Failed to send verification email");
    }

    console.log("Login code email sent:", result.id);

    return new Response(JSON.stringify({ message: "Code sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-login-code error:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to send login code. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
