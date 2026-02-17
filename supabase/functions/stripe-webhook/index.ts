import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const logStep = (step: string, details?: any) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) throw new Error("Stripe config missing");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) throw new Error("No signature");

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const planType = session.metadata?.plan_type || "single";
      const orgName = session.metadata?.org_name || "My Organization";
      const stripeCustomerId = session.customer as string;
      const stripeSubscriptionId = session.subscription as string;

      if (!userId) {
        logStep("ERROR: No user_id in metadata");
        return new Response("OK", { status: 200 });
      }

      logStep("Processing checkout", { userId, planType, orgName });

      // Create organization
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          name: orgName,
          owner_id: userId,
          stripe_customer_id: stripeCustomerId,
          plan_type: planType,
          is_active: true,
        })
        .select()
        .single();

      if (orgError) {
        logStep("ERROR creating org", { error: orgError.message });
        throw orgError;
      }
      logStep("Organization created", { orgId: org.id });

      // Add owner as admin member
      const { error: memberError } = await supabaseAdmin
        .from("org_members")
        .insert({
          organization_id: org.id,
          user_id: userId,
          role: "admin",
        });

      if (memberError) {
        logStep("ERROR adding owner as member", { error: memberError.message });
      }

      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      // Create subscription record
      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          user_id: userId,
          organization_id: org.id,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: stripeCustomerId,
          plan_type: planType,
          status: "active",
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        });

      if (subError) {
        logStep("ERROR creating subscription record", { error: subError.message });
      }

      logStep("Checkout processing complete");
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubId = subscription.id;

      const status = subscription.status === "active" ? "active"
        : subscription.status === "past_due" ? "past_due"
        : subscription.status === "trialing" ? "trialing"
        : subscription.status === "canceled" ? "canceled"
        : "inactive";

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq("stripe_subscription_id", stripeSubId);

      if (error) logStep("ERROR updating subscription", { error: error.message });
      else logStep("Subscription updated", { stripeSubId, status });

      // If canceled, deactivate the org
      if (status === "canceled") {
        const { data: subData } = await supabaseAdmin
          .from("subscriptions")
          .select("organization_id")
          .eq("stripe_subscription_id", stripeSubId)
          .single();

        if (subData?.organization_id) {
          await supabaseAdmin
            .from("organizations")
            .update({ is_active: false })
            .eq("id", subData.organization_id);
          logStep("Organization deactivated", { orgId: subData.organization_id });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubId = subscription.id;

      const { data: subData } = await supabaseAdmin
        .from("subscriptions")
        .select("organization_id")
        .eq("stripe_subscription_id", stripeSubId)
        .single();

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", stripeSubId);

      if (subData?.organization_id) {
        await supabaseAdmin
          .from("organizations")
          .update({ is_active: false })
          .eq("id", subData.organization_id);
        logStep("Subscription deleted & org deactivated", { orgId: subData.organization_id });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logStep("FATAL ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }
});
