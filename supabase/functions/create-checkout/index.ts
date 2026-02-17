import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan configuration
const PLANS = {
  single_monthly: "price_1T1rDFITgrigwGQMKpXFISbQ",
  single_yearly: "price_1T1rEpITgrigwGQMFz2Eu31j",
  multi_monthly: "price_1T1rG2ITgrigwGQMZf2mHytU",
  multi_yearly: "price_1T1rP5ITgrigwGQMONH9gmdw",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    const { priceKey, orgName } = await req.json();
    if (!priceKey || !PLANS[priceKey as keyof typeof PLANS]) {
      throw new Error("Invalid plan selected");
    }
    if (!orgName || typeof orgName !== "string" || orgName.trim().length === 0 || orgName.length > 100) {
      throw new Error("Invalid organization name");
    }

    const priceId = PLANS[priceKey as keyof typeof PLANS];
    const planType = priceKey.startsWith("single") ? "single" : "multi";
    logStep("Plan selected", { priceKey, priceId, planType });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }
    logStep("Customer lookup", { customerId: customerId || "new" });

    const origin = req.headers.get("origin") || "https://dexsora.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        user_id: user.id,
        plan_type: planType,
        org_name: orgName.trim(),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: planType,
          org_name: orgName.trim(),
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
