import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require bootstrap token for security
  const bootstrapToken = Deno.env.get("BOOTSTRAP_TOKEN");
  const providedToken = req.headers.get("X-Bootstrap-Token");
  if (!bootstrapToken || providedToken !== bootstrapToken) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: { id: string; email: string; deleted: boolean; error?: string }[] = [];

  for (const user of users) {
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    results.push({ id: user.id, email: user.email ?? "", deleted: !delError, error: delError?.message });
  }

  return new Response(
    JSON.stringify({ deleted: results.filter(r => r.deleted).length, failed: results.filter(r => !r.deleted), results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
