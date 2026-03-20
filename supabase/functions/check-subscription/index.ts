import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || null;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const requestBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tenantId = requestBody?.tenant_id;
    if (!tenantId) throw new Error("tenant_id is required");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      throw new Error(`Authentication error: ${claimsError?.message ?? "Invalid token"}`);
    }

    const userId = String(claimsData.claims.sub ?? "");
    if (!userId) throw new Error("User not authenticated");

    const { data: membership, error: membershipError } = await serviceClient
      .from("tenant_members")
      .select("tenant_id, invitation_status")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership || membership.invitation_status !== "accepted") {
      throw new Error("You do not have access to this workspace");
    }

    const { data: workspaceSubscription } = await serviceClient
      .from("workspace_subscriptions")
      .select("plan_id, subscription_status, stripe_subscription_id, current_period_end, stripe_customer_id")
      .eq("workspace_id", tenantId)
      .single();

    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("trial_ends_at")
      .eq("id", tenantId)
      .single();

    const isTrialActive = workspaceSubscription?.subscription_status === "trial"
      && !!tenant?.trial_ends_at
      && new Date(tenant.trial_ends_at).getTime() > Date.now();

    const isActive = workspaceSubscription?.subscription_status === "active";

    if (!workspaceSubscription || (!isActive && !isTrialActive)) {
      return new Response(JSON.stringify({
        subscribed: false,
        product_id: null,
        price_id: null,
        subscription_end: null,
        source: "workspace",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let priceId = null;
    let productId = null;
    let subscriptionEnd = workspaceSubscription.current_period_end;

    if (isActive && workspaceSubscription.stripe_subscription_id && stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const subscription = await stripe.subscriptions.retrieve(workspaceSubscription.stripe_subscription_id);
        priceId = subscription.items.data[0]?.price?.id ?? null;
        productId = subscription.items.data[0]?.price?.product ?? null;
        subscriptionEnd = typeof subscription.current_period_end === "number"
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : subscriptionEnd;
      } catch (stripeErr) {
        logStep("Stripe lookup failed, using workspace data only", { error: String(stripeErr), tenantId });
      }
    }

    return new Response(JSON.stringify({
      subscribed: true,
      product_id: productId,
      price_id: priceId,
      subscription_end: subscriptionEnd,
      source: "workspace",
      status: workspaceSubscription.subscription_status,
      plan_id: workspaceSubscription.plan_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
