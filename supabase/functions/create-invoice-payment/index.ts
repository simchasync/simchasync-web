import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoice_id, amount } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(name, email)")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", invoice.tenant_id)
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("stripe_connect_account_id, stripe_connect_onboarded, name")
      .eq("id", invoice.tenant_id)
      .single();

    if (!tenant?.stripe_connect_account_id || !tenant.stripe_connect_onboarded) {
      return new Response(JSON.stringify({ error: "Stripe Connect not set up for this workspace. Please connect Stripe in Settings first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const chargeAmount = amount ? Math.round(Number(amount) * 100) : Math.round(invoice.amount * 100);

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice from ${tenant.name}`,
            description: invoice.clients?.name ? `Client: ${invoice.clients.name}` : undefined,
          },
          unit_amount: chargeAmount,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/payment-success?invoice_id=${invoice_id}`,
      cancel_url: `${origin}/payment-cancelled`,
      customer_email: invoice.clients?.email || undefined,
      metadata: {
        invoice_id,
        event_id: invoice.event_id || "",
      },
    }, {
      stripeAccount: tenant.stripe_connect_account_id,
    });

    await supabase.from("invoices").update({
      stripe_payment_url: session.url,
    }).eq("id", invoice_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-invoice-payment error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
