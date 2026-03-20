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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("billing_admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

    const body = await req.json().catch(() => ({}));
    const days = body.days || 30;
    const since = Math.floor(Date.now() / 1000) - days * 86400;

    const charges: Stripe.Charge[] = [];
    for await (const charge of stripe.charges.list({ created: { gte: since }, limit: 100 })) {
      charges.push(charge);
    }

    const totalRevenue = charges
      .filter((c) => c.status === "succeeded")
      .reduce((sum, c) => sum + c.amount, 0);

    const refunds = charges
      .filter((c) => c.refunded || (c.amount_refunded > 0))
      .reduce((sum, c) => sum + c.amount_refunded, 0);

    const subscriptions: Stripe.Subscription[] = [];
    for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
      subscriptions.push(sub);
    }

    const mrr = subscriptions.reduce((sum, sub) => {
      const item = sub.items.data[0];
      return sum + (item?.price.unit_amount || 0);
    }, 0);

    const revenueByPlan: Record<string, number> = { lite: 0, full: 0, other: 0 };
    for (const sub of subscriptions) {
      const amount = sub.items.data[0]?.price.unit_amount || 0;
      if (amount <= 6099) revenueByPlan.lite += amount;
      else if (amount <= 9099) revenueByPlan.full += amount;
      else revenueByPlan.other += amount;
    }

    const newSubs: Stripe.Subscription[] = [];
    for await (const sub of stripe.subscriptions.list({ created: { gte: since }, limit: 100, status: "all" })) {
      newSubs.push(sub);
    }
    const newSubsCount = newSubs.length;

    const canceledCount = newSubs.filter((s) => s.status === "canceled").length;

    const dailyRevenue: Record<string, number> = {};
    for (const charge of charges.filter((c) => c.status === "succeeded")) {
      const day = new Date(charge.created * 1000).toISOString().split("T")[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + charge.amount;
    }

    return new Response(JSON.stringify({
      total_revenue_cents: totalRevenue,
      refunds_cents: refunds,
      mrr_cents: mrr,
      active_subscriptions: subscriptions.length,
      new_subscriptions: newSubsCount,
      canceled: canceledCount,
      revenue_by_plan: revenueByPlan,
      daily_revenue: dailyRevenue,
      period_days: days,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[admin-stripe-reporting] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
