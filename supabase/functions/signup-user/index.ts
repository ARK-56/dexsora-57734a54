import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;

async function sendVerificationEmail(email: string, fullName: string, verifyUrl: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured, skipping verification email");
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
        <tr><td style="background:linear-gradient(135deg,hsl(183,60%,20%),hsl(183,100%,25%));padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Dexsora</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;font-weight:600;">Verify Your Email</h2>
          <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
            Hi <strong style="color:#18181b;">${fullName}</strong>, thanks for signing up for <strong style="color:#18181b;">Dexsora</strong>. 
            Please verify your email address by clicking the button below.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,hsl(183,60%,20%),hsl(183,100%,25%));color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:8px;">Verify Email Address</a>
          </td></tr></table>
          <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${verifyUrl}" style="color:hsl(183,100%,25%);word-break:break-all;">${verifyUrl}</a>
          </p>
          <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;">
            If you didn't create an account, you can safely ignore this email.
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
        subject: "Verify your Dexsora account",
        html: htmlContent,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
    } else {
      console.log("Verification email sent:", result.id);
    }
  } catch (e) {
    console.error("Failed to send verification email:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, fullName, plan } = await req.json();

    if (!email || !password || !fullName) {
      throw new Error("Email, password, and full name are required");
    }
    if (!isValidEmail(email)) {
      throw new Error("Invalid email format");
    }
    if (password.length < 8 || password.length > 128) {
      throw new Error("Password must be 8-128 characters");
    }
    if (fullName.length === 0 || fullName.length > 100 || /[<>{}]/.test(fullName)) {
      throw new Error("Invalid name format");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    // Create user with email NOT confirmed — they must verify first
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName.trim() },
    });

    if (createError) throw createError;

    // Generate email confirmation link
    const redirectUrl = plan
      ? `https://dexsora.com/onboarding?plan=${plan}`
      : "https://dexsora.com/onboarding";

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      options: { redirectTo: redirectUrl },
    });

    if (linkError) {
      console.error("generateLink error:", linkError);
      throw new Error("Failed to generate verification link");
    }

    const verifyUrl = linkData?.properties?.action_link;
    if (!verifyUrl) {
      throw new Error("Failed to generate verification link");
    }

    // Send branded verification email via Resend
    await sendVerificationEmail(email, fullName.trim(), verifyUrl);

    return new Response(
      JSON.stringify({ message: "Verification email sent", userId: newUser.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error.message?.toLowerCase() || "";
    let safeMessage = "Unable to complete signup. Please try again.";
    if (msg.includes("already exists")) safeMessage = "A user with this email already exists.";
    else if (msg.includes("invalid email")) safeMessage = "Please enter a valid email address.";
    else if (msg.includes("password must")) safeMessage = error.message;
    else if (msg.includes("invalid name")) safeMessage = "Please enter a valid name.";
    else if (msg.includes("required")) safeMessage = error.message;

    console.error("signup-user error:", error.message);
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
