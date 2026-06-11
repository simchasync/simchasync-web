/// <reference path="../_shared/deno-runtime.d.ts" />
import Stripe from "stripe";
import {
  adminCors, getErrorMessage, createAdminClient,
  authenticate, getUserRoles,
  isAdmin, isBillingAdmin,
  auditLog,
} from "../_shared/admin-helpers.ts";
import { ONE_YEAR_MS } from "../_shared/pricing.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = adminCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const adminClient = createAdminClient();
    const auth = await authenticate(adminClient, req.headers.get("Authorization"));
    if (!auth.user) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userRoles = await getUserRoles(adminClient, auth.user.id);
    if (!isAdmin(userRoles) && !isBillingAdmin(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "extend_trial": {
        const { tenant_id, new_trial_end } = body;
        if (!tenant_id || !new_trial_end) return new Response(JSON.stringify({ error: "Missing tenant_id or new_trial_end" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("tenants").update({ trial_ends_at: new_trial_end }).eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "extend_trial", tenant_id, undefined, { new_trial_end });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "change_plan": {
        const { tenant_id, plan } = body;
        if (!tenant_id || !plan) return new Response(JSON.stringify({ error: "Missing tenant_id or plan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const updatePayload: Record<string, any> = { plan, is_manual_override: true, last_synced_at: new Date().toISOString() };
        if (plan !== "trial") {
          updatePayload.stripe_subscription_status = "active";
          updatePayload.stripe_current_period_end = new Date(Date.now() + ONE_YEAR_MS).toISOString();
        } else {
          updatePayload.stripe_subscription_status = null;
          updatePayload.stripe_current_period_end = null;
          updatePayload.stripe_plan_price_id = null;
          updatePayload.stripe_mrr_cents = 0;
        }
        const { error } = await adminClient.from("tenants").update(updatePayload).eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "change_plan", tenant_id, undefined, { plan, is_manual_override: true });
        return new Response(JSON.stringify({ success: true, plan, is_manual_override: true, updated_fields: Object.keys(updatePayload) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "remove_override": {
        const { tenant_id } = body;
        if (!tenant_id) return new Response(JSON.stringify({ error: "Missing tenant_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("tenants").update({ is_manual_override: false, last_synced_at: new Date().toISOString() }).eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "remove_override", tenant_id);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "set_custom_price": {
        const { tenant_id, custom_price_cents } = body;
        if (!tenant_id) return new Response(JSON.stringify({ error: "Missing tenant_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("tenants").update({ custom_price_cents: custom_price_cents ?? null }).eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "set_custom_price", tenant_id, undefined, { custom_price_cents });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "resync_stripe": {
        const { tenant_id } = body;
        if (!tenant_id) return new Response(JSON.stringify({ error: "Missing tenant_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const { data: tenant } = await adminClient.from("tenants").select("id, stripe_customer_id").eq("id", tenant_id).single();
        if (!tenant) return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        let customerId = tenant.stripe_customer_id;
        if (!customerId) {
          const { data: ownerMember } = await adminClient.from("tenant_members").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1);
          if (ownerMember && ownerMember.length > 0) {
            const { data: ownerProfile } = await adminClient.from("profiles").select("email").eq("user_id", ownerMember[0].user_id).single();
            if (ownerProfile?.email) {
              const customers = await stripe.customers.list({ email: ownerProfile.email, limit: 1 });
              if (customers.data.length > 0) customerId = customers.data[0].id;
            }
          }
        }
        if (!customerId) {
          await adminClient.from("tenants").update({ stripe_subscription_status: null, stripe_mrr_cents: 0, last_synced_at: new Date().toISOString() }).eq("id", tenant_id);
          await auditLog(adminClient, auth.user.id, "resync_stripe", tenant_id, undefined, { result: "no_customer" });
          return new Response(JSON.stringify({ success: true, status: "no_customer_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        let subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
        if (subs.data.length === 0) subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
        if (subs.data.length > 0) {
          const sub = subs.data[0];
          const item = sub.items.data[0];
          const mrrCents = item ? (item.price.unit_amount || 0) : 0;
          let plan: string | undefined;
          if (sub.status === "active") { const amount = item?.price.unit_amount || 0; plan = amount <= 6099 ? "lite" : "full"; }
          const periodEnd = sub.current_period_end;
          let periodEndIso: string | null = null;
          try { periodEndIso = typeof periodEnd === 'number' ? new Date(periodEnd * 1000).toISOString() : typeof periodEnd === 'string' ? new Date(periodEnd).toISOString() : null; } catch (_) { periodEndIso = null; }
          const updateData: Record<string, any> = { stripe_customer_id: customerId, stripe_subscription_id: sub.id, stripe_subscription_status: sub.status, stripe_plan_price_id: item?.price.id || null, stripe_current_period_end: periodEndIso, stripe_mrr_cents: mrrCents, last_synced_at: new Date().toISOString() };
          if (plan) updateData.plan = plan;
          await adminClient.from("tenants").update(updateData).eq("id", tenant_id);
        } else {
          await adminClient.from("tenants").update({ stripe_customer_id: customerId, stripe_subscription_status: null, stripe_mrr_cents: 0, last_synced_at: new Date().toISOString() }).eq("id", tenant_id);
        }
        await auditLog(adminClient, auth.user.id, "resync_stripe", tenant_id, undefined, { customer_id: customerId });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
