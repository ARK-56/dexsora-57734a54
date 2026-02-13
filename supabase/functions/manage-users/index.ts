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

    if (action === "create") {
      const { email, password, fullName, role } = payload;
      if (!email || !password || !role) throw new Error("Missing required fields");
      if (!isValidEmail(email)) throw new Error("Invalid email format");
      if (!isValidPassword(password)) throw new Error("Password must be 8-128 characters");
      if (fullName && !isValidName(fullName)) throw new Error("Invalid name format");
      if (!VALID_STAFF_ROLES.includes(role)) throw new Error("Invalid role. Must be one of: " + VALID_STAFF_ROLES.join(", "));

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || email },
      });

      if (createError) throw createError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });

      if (roleError) throw roleError;

      return new Response(
        JSON.stringify({ message: "User created", userId: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_doctor") {
      const { email, password, fullName, npi } = payload;
      if (!email || !password || !fullName || !npi) throw new Error("Missing required fields");
      if (!isValidEmail(email)) throw new Error("Invalid email format");
      if (!isValidPassword(password)) throw new Error("Password must be 8-128 characters");
      if (!isValidName(fullName)) throw new Error("Invalid name format");
      if (!isValidNPI(npi)) throw new Error("NPI must be exactly 10 digits");

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError) throw createError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "doctor" });

      if (roleError) throw roleError;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ npi })
        .eq("user_id", newUser.user.id);

      if (profileError) throw profileError;

      return new Response(
        JSON.stringify({ message: "Doctor created", userId: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const { userId, fullName, email, role } = payload;
      if (!userId) throw new Error("Missing userId");

      // Validate UUID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format");
      }

      if (fullName !== undefined && !isValidName(fullName)) throw new Error("Invalid name format");
      if (email !== undefined && !isValidEmail(email)) throw new Error("Invalid email format");
      if (role && !VALID_ALL_ROLES.includes(role)) throw new Error("Invalid role");

      // Prevent admin from removing their own admin role
      if (userId === caller.id && role && role !== "admin") {
        throw new Error("Cannot remove your own admin role");
      }

      if (fullName !== undefined || email !== undefined) {
        const updates: any = {};
        if (fullName !== undefined) updates.full_name = fullName;
        if (email !== undefined) updates.email = email;

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(updates)
          .eq("user_id", userId);

        if (profileError) throw profileError;
      }

      if (role) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role });

        if (roleError) throw roleError;
      }

      return new Response(
        JSON.stringify({ message: "User updated" }),
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
