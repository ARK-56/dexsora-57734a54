import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINGLE_ORG_PRODUCTS = ["prod_TzqvpodntAjz8q", "prod_TzqwJA23CXpjFZ"];
const MULTI_ORG_PRODUCTS = ["prod_TzqxgS9Jj4DvuW", "prod_Tzr7HXqBrr4uuM"];

const logStep = (step: string, details?: any) => {
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false, plan_type: null, subscription_end: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Also check trialing
      const trialingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
      if (trialingSubs.data.length === 0) {
        logStep("No active subscription");
        return new Response(JSON.stringify({ subscribed: false, plan_type: null, subscription_end: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subscriptions.data = trialingSubs.data;
    }

    const sub = subscriptions.data[0];
    const productId = sub.items.data[0].price.product as string;
    let planType = "single";
    if (MULTI_ORG_PRODUCTS.includes(productId)) {
      planType = "multi";
    }

    const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
    logStep("Active subscription found", { planType, subscriptionEnd });

    return new Response(JSON.stringify({
      subscribed: true,
      plan_type: planType,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
