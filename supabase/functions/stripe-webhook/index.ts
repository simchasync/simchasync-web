import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (msg: string, details?: any) => {
  const d = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[stripe-webhook] ${msg}${d}`);
};

async function findTenantByStripeCustomer(
  supabase: any,
  stripe: Stripe,
  customerId: string,
  subscriptionId?: string | null,
  metadataTenantId?: string | null,
): Promise<{ tenantId: string | null; customerEmail: string | null }> {
  if (subscriptionId) {
    const { data: directWorkspaceSubscription } = await supabase
      .from("workspace_subscriptions")
      .select("workspace_id")
      .eq("stripe_subscription_id", subscriptionId)
      .limit(1)
      .maybeSingle();

    if (directWorkspaceSubscription) {
      return { tenantId: directWorkspaceSubscription.workspace_id, customerEmail: null };
    }
  }

  if (metadataTenantId) {
    return { tenantId: metadataTenantId, customerEmail: null };
  }

  const { data: directWorkspace } = await supabase
    .from("workspace_subscriptions")
    .select("workspace_id")
    .eq("stripe_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (directWorkspace) return { tenantId: directWorkspace.workspace_id, customerEmail: null };

  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as any).deleted || !(customer as Stripe.Customer).email) {
    return { tenantId: null, customerEmail: null };
  }
  const email = (customer as Stripe.Customer).email!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (!profile) return { tenantId: null, customerEmail: email };

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", profile.user_id)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    tenantId: membership?.tenant_id || null,
    customerEmail: email,
  };
}

async function isManualOverride(supabase: any, tenantId: string): Promise<boolean> {
  const { data } = await supabase
    .from("tenants")
    .select("is_manual_override")
    .eq("id", tenantId)
    .single();
  return data?.is_manual_override === true;
}

async function syncSubscriptionToTenant(
  supabase: any,
  tenantId: string,
  subscription: Stripe.Subscription,
  customerId: string
) {
  const override = await isManualOverride(supabase, tenantId);
  const item = subscription.items.data[0];
  const mrrCents = item ? (item.price.unit_amount || 0) : 0;

  await supabase
    .from("workspace_subscriptions")
    .update({
      user_id: null,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      plan_id: subscription.status === "active"
        ? ((item?.price.unit_amount || 0) <= 6099 ? "lite" : "full")
        : null,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      workspace_limits: subscription.status === "active"
        ? null
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", tenantId);

  if (override) {
    log("Manual override active — only updating Stripe metadata", { tenantId });
    const { error } = await supabase
      .from("tenants")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_mrr_cents: mrrCents,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
    if (error) console.error("[stripe-webhook] tenant metadata sync error:", error);
    return error;
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_plan_price_id: item?.price.id || null,
      stripe_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      stripe_mrr_cents: mrrCents,
      last_synced_at: new Date().toISOString(),
      plan: subscription.status === "active"
        ? ((item?.price.unit_amount || 0) <= 6099 ? "lite" : "full")
        : "none",
    })
    .eq("id", tenantId);

  if (error) console.error("[stripe-webhook] tenant sync error:", error);
  return error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;
    if (sig && webhookSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      } catch (err) {
        console.error("[stripe-webhook] Signature verification failed:", err);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      try {
        event = JSON.parse(body) as Stripe.Event;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid payload" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    log("Event type:", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      const eventId = session.metadata?.event_id;
      const metaTenantId = session.metadata?.tenant_id;
      const paymentIntentId = session.payment_intent as string;

      if (invoiceId) {
        const { data: inv } = await supabase.from("invoices").select("event_id, amount").eq("id", invoiceId).single();

        const { error } = await supabase.from("invoices").update({
          status: "paid",
          stripe_payment_id: paymentIntentId,
          stripe_payment_url: null,
        }).eq("id", invoiceId);
        if (error) console.error("[stripe-webhook] Invoice update error:", error);

        if (eventId || inv?.event_id) {
          const targetEventId = eventId || inv?.event_id;
          const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

          const { error: epErr } = await supabase.from("event_payments").insert({
            event_id: targetEventId,
            invoice_id: invoiceId,
            amount: amountPaid,
            method: "credit_card",
            notes: `Stripe payment ${paymentIntentId}`,
            payment_date: new Date().toISOString().split("T")[0],
          });
          if (epErr) console.error("[stripe-webhook] event_payments insert error:", epErr);

          const { data: eventData } = await supabase
            .from("events")
            .select("total_price, deposit, payment_status, deposit_status")
            .eq("id", targetEventId)
            .single();

          if (eventData) {
            const totalPrice = Number(eventData.total_price) || 0;
            const deposit = Number(eventData.deposit) || 0;

            const { data: allPayments } = await supabase
              .from("event_payments")
              .select("amount")
              .eq("event_id", targetEventId);
            const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

            const updates: any = {};

            if (deposit > 0 && amountPaid >= deposit && eventData.deposit_status !== "paid") {
              updates.deposit_status = "paid";
            } else if (deposit > 0 && totalPaid >= deposit) {
              updates.deposit_status = "paid";
            }

            if (totalPaid >= totalPrice) {
              updates.payment_status = "paid";
              updates.balance_due = 0;
            } else if (totalPaid > 0) {
              updates.payment_status = "partial";
              updates.balance_due = Math.max(totalPrice - totalPaid, 0);
            }

            if (Object.keys(updates).length > 0) {
              const { error: evUpErr } = await supabase.from("events").update(updates).eq("id", targetEventId);
              if (evUpErr) console.error("[stripe-webhook] event status update error:", evUpErr);
              else log("Auto-updated booking status", { targetEventId, updates });
            }
          }
        }
      }

      if (session.customer && session.subscription) {
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const tenantId = metaTenantId || null;

        if (tenantId) {
          await supabase.from("tenants").update({ is_manual_override: false }).eq("id", tenantId);
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToTenant(supabase, tenantId, sub, customerId);
          log("Updated workspace subscription from checkout", { tenantId, subscriptionId });
        }
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const metadataTenantId = subscription.metadata?.tenant_id || null;
      const { tenantId } = await findTenantByStripeCustomer(supabase, stripe, customerId, subscription.id, metadataTenantId);

      if (tenantId) {
        await syncSubscriptionToTenant(supabase, tenantId, subscription, customerId);
      } else {
        log("No tenant found for subscription", { customerId, subscriptionId: subscription.id });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const metadataTenantId = subscription.metadata?.tenant_id || null;
      const { tenantId } = await findTenantByStripeCustomer(supabase, stripe, customerId, subscription.id, metadataTenantId);

      if (tenantId) {
        const override = await isManualOverride(supabase, tenantId);
        await supabase.from("workspace_subscriptions").update({
          subscription_status: "canceled",
          plan_id: null,
          current_period_end: null,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
        }).eq("workspace_id", tenantId);

        if (override) {
          await supabase.from("tenants").update({
            stripe_mrr_cents: 0,
            last_synced_at: new Date().toISOString(),
          }).eq("id", tenantId);
        } else {
          await supabase.from("tenants").update({
            plan: "none",
            stripe_subscription_status: "canceled",
            stripe_mrr_cents: 0,
            last_synced_at: new Date().toISOString(),
          }).eq("id", tenantId);
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (customerId) {
        const { tenantId } = await findTenantByStripeCustomer(supabase, stripe, customerId, subscriptionId, null);
        if (tenantId) {
          const override = await isManualOverride(supabase, tenantId);
          await supabase.from("workspace_subscriptions").update({
            subscription_status: "past_due",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          }).eq("workspace_id", tenantId);

          if (!override) {
            await supabase.from("tenants").update({
              stripe_subscription_status: "past_due",
              last_synced_at: new Date().toISOString(),
            }).eq("id", tenantId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
