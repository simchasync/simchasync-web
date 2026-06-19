/// <reference path="../_shared/deno-runtime.d.ts" />
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ValidationError, parseBody } from "../_shared/validation.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const checkoutSchema = z.object({
  price_id: z.string().min(1, "price_id is required"),
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("APP_SECRET_API_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { price_id, tenant_id } = parseBody(checkoutSchema, await req.json());

    const { data: membership, error: membershipError } = await supabaseClient
      .from("tenant_members")
      .select("tenant_id, role, invitation_status")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership || membership.invitation_status !== "accepted") {
      throw new Error("You do not have access to this workspace");
    }

    if (membership.role !== "owner") {
      throw new Error("Only the workspace owner can manage billing");
    }

    const { data: workspaceSubscription } = await supabaseClient
      .from("workspace_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, subscription_status")
      .eq("workspace_id", tenant_id)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId = workspaceSubscription?.stripe_customer_id || undefined;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = customers.data[0]?.id;
    }

    if (customerId) {
      await supabaseClient
        .from("workspace_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("workspace_id", tenant_id);

      await supabaseClient
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenant_id);
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: price_id, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/app/settings?subscription_success=true`,
      cancel_url: `${origin}/app/upgrade`,
      metadata: { tenant_id },
      subscription_data: {
        metadata: { tenant_id },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, tenant_id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof ValidationError ? 400 : 500,
    });
  }
});
