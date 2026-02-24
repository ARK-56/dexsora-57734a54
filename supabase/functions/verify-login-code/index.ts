import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();
    if (!email || !code) throw new Error("Email and code are required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const user = usersData?.users?.find((u: any) => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid code" }), {
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

    // Check expiry
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Code has expired. Please request a new one." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as verified
    await supabaseAdmin
      .from("login_verifications")
      .update({ verified: true })
      .eq("id", verification.id);

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("verify-login-code error:", error.message);
    return new Response(
      JSON.stringify({ error: "Verification failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
