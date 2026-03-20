import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[cancel-subscription] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { action, reason, details, tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id required");
    if (!action) throw new Error("action required");

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();
    if (!membership) throw new Error("Not a member of this tenant");

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, plan, stripe_subscription_id, stripe_customer_id")
      .eq("id", tenant_id)
      .single();
    if (!tenant) throw new Error("Tenant not found");
    if (!tenant.stripe_subscription_id) throw new Error("No active subscription found");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

    if (action === "cancel") {
      if (!reason) throw new Error("reason required for cancellation");
      logStep("Canceling subscription at period end", { subId: tenant.stripe_subscription_id });

      const updatedSub = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      await supabase.from("tenants").update({
        stripe_subscription_status: "canceling",
        last_synced_at: new Date().toISOString(),
      }).eq("id", tenant_id);

      await supabase.from("cancellation_feedback").insert({
        tenant_id,
        user_id: user.id,
        user_email: user.email,
        tenant_name: tenant.name,
        plan: tenant.plan,
        reason,
        details: details || null,
        outcome: "canceled",
      });

      await sendAdminEmail(tenant, user, reason, details, "canceled");

      const cancelAt = updatedSub.cancel_at
        ? new Date(updatedSub.cancel_at * 1000).toISOString()
        : updatedSub.current_period_end
          ? new Date(updatedSub.current_period_end * 1000).toISOString()
          : null;

      logStep("Subscription canceled at period end", { cancelAt });
      return new Response(JSON.stringify({ success: true, cancel_at: cancelAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "apply_retention_offer") {
      if (!reason) throw new Error("reason required");
      logStep("Applying retention offer", { subId: tenant.stripe_subscription_id });

      const coupon = await stripe.coupons.create({
        percent_off: 50,
        duration: "repeating",
        duration_in_months: 2,
        name: "Retention Offer - 50% off for 2 months",
      });
      logStep("Coupon created", { couponId: coupon.id });

      await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        discounts: [{ coupon: coupon.id }],
      });
      logStep("Discount applied to subscription");

      await supabase.from("tenants").update({
        last_synced_at: new Date().toISOString(),
      }).eq("id", tenant_id);

      await supabase.from("cancellation_feedback").insert({
        tenant_id,
        user_id: user.id,
        user_email: user.email,
        tenant_name: tenant.name,
        plan: tenant.plan,
        reason,
        details: details || null,
        outcome: "accepted_offer",
      });

      await sendAdminEmail(tenant, user, reason, details, "accepted_offer");

      logStep("Retention offer applied successfully");
      return new Response(JSON.stringify({ success: true, discount_applied: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendAdminEmail(
  tenant: any,
  user: any,
  reason: string,
  details: string | null,
  outcome: string
) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.log("[cancel-subscription] No RESEND_API_KEY, skipping admin email");
    return;
  }

  const adminEmail = "admin@simchasync.com";

  const outcomeLabel = outcome === "accepted_offer"
    ? "✅ Accepted Retention Offer (50% off for 2 months)"
    : "❌ Canceled Subscription";

  const html = `
    <h2>Cancellation Feedback</h2>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Tenant</td><td style="padding:8px;border:1px solid #ddd;">${tenant.name}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">User Email</td><td style="padding:8px;border:1px solid #ddd;">${user.email}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Plan</td><td style="padding:8px;border:1px solid #ddd;">${tenant.plan}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Reason</td><td style="padding:8px;border:1px solid #ddd;">${reason}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Details</td><td style="padding:8px;border:1px solid #ddd;">${details || "—"}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Outcome</td><td style="padding:8px;border:1px solid #ddd;">${outcomeLabel}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Timestamp</td><td style="padding:8px;border:1px solid #ddd;">${new Date().toISOString()}</td></tr>
    </table>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SimchaSync <noreply@simchasync.com>",
        to: [adminEmail],
        subject: `[Cancellation] ${tenant.name} — ${outcome === "accepted_offer" ? "Accepted Offer" : "Canceled"}`,
        html,
      }),
    });
    logStep("Admin email sent", { status: res.status });
  } catch (e) {
    console.error("[cancel-subscription] Failed to send admin email:", e);
  }
}
