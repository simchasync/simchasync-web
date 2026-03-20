import { createClient } from "npm:@supabase/supabase-js@2.57.2";
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

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized", detail: authError?.message }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: authUser.id };

    const { tenant_id, action } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only owners can manage Stripe Connect" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("stripe_connect_account_id, stripe_connect_onboarded, name")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_status") {
      if (!tenant.stripe_connect_account_id) {
        return new Response(JSON.stringify({ onboarded: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const account = await stripe.accounts.retrieve(tenant.stripe_connect_account_id);
      const onboarded = account.charges_enabled && account.payouts_enabled;
      
      if (onboarded && !tenant.stripe_connect_onboarded) {
        await supabase.from("tenants").update({ stripe_connect_onboarded: true }).eq("id", tenant_id);
      }

      return new Response(JSON.stringify({ onboarded, account_id: tenant.stripe_connect_account_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accountId = tenant.stripe_connect_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        business_profile: { name: tenant.name },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      await supabase.from("tenants")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", tenant_id);
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/app/settings?stripe_refresh=true`,
      return_url: `${origin}/app/settings?stripe_return=true`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url, account_id: accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-connect-account error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
