import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function auditLog(
  adminClient: any,
  adminUserId: string,
  action: string,
  targetTenantId?: string,
  targetUserId?: string,
  details?: Record<string, any>
) {
  await adminClient.from("admin_audit_logs").insert({
    admin_user_id: adminUserId,
    action,
    target_tenant_id: targetTenantId || null,
    target_user_id: targetUserId || null,
    details: details || {},
  });
}

// Helper: given tenant_members rows, enrich with profile data
async function enrichMembersWithProfiles(adminClient: any, members: any[]) {
  if (!members || members.length === 0) return [];
  const userIds = [...new Set(members.map((m: any) => m.user_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("user_id, full_name, email, avatar_url")
    .in("user_id", userIds);
  const profileMap: Record<string, any> = {};
  for (const p of (profiles || [])) {
    profileMap[p.user_id] = p;
  }
  return members.map((m: any) => ({
    ...m,
    profiles: profileMap[m.user_id] || null,
  }));
}

// Helper: given user_roles rows, enrich with profile data
async function enrichRolesWithProfiles(adminClient: any, roles: any[]) {
  if (!roles || roles.length === 0) return [];
  const userIds = [...new Set(roles.map((r: any) => r.user_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);
  const profileMap: Record<string, any> = {};
  for (const p of (profiles || [])) {
    profileMap[p.user_id] = p;
  }
  return roles.map((r: any) => ({
    ...r,
    profiles: profileMap[r.user_id] || null,
  }));
}

// Helper: given audit_logs rows, enrich with profile data
async function enrichLogsWithProfiles(adminClient: any, logs: any[]) {
  if (!logs || logs.length === 0) return [];
  const userIds = [...new Set(logs.map((l: any) => l.admin_user_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);
  const profileMap: Record<string, any> = {};
  for (const p of (profiles || [])) {
    profileMap[p.user_id] = p;
  }
  return logs.map((l: any) => ({
    ...l,
    profiles: profileMap[l.admin_user_id] || null,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[ADMIN] No auth header");
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
      console.error("[ADMIN] Auth failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.log("[ADMIN] Authenticated user:", userId);

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes("admin");
    const isBillingAdmin = userRoles.includes("billing_admin");
    const isSupportAgent = userRoles.includes("support_agent");

    console.log("[ADMIN] Roles:", userRoles.join(", "));

    if (!isAdmin && !isBillingAdmin && !isSupportAgent) {
      console.error("[ADMIN] No admin role for user:", userId);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    console.log("[ADMIN] Action:", action);

    switch (action) {
      case "list_tenants": {
        const { search, page = 1, page_size = 50 } = body;
        const offset = (page - 1) * page_size;

        // Query tenants without joins
        let query = adminClient
          .from("tenants")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + page_size - 1);

        if (search) {
          query = query.ilike("name", `%${search}%`);
        }

        const { data: tenants, error, count } = await query;
        if (error) {
          console.error("[ADMIN] list_tenants query error:", error.message);
          throw error;
        }

        // Enrich with tenant_members + profiles
        const tenantIds = (tenants || []).map((t: any) => t.id);
        let enrichedTenants = tenants || [];

        if (tenantIds.length > 0) {
          const { data: allMembers } = await adminClient
            .from("tenant_members")
            .select("id, user_id, role, tenant_id")
            .in("tenant_id", tenantIds);

          const enrichedMembers = await enrichMembersWithProfiles(adminClient, allMembers || []);

          // Group by tenant_id
          const membersByTenant: Record<string, any[]> = {};
          for (const m of enrichedMembers) {
            if (!membersByTenant[m.tenant_id]) membersByTenant[m.tenant_id] = [];
            membersByTenant[m.tenant_id].push(m);
          }

          enrichedTenants = (tenants || []).map((t: any) => ({
            ...t,
            tenant_members: membersByTenant[t.id] || [],
          }));
        }

        console.log("[ADMIN] list_tenants returned", enrichedTenants.length, "tenants, total:", count);

        return new Response(JSON.stringify({ tenants: enrichedTenants, total: count || 0, page, page_size }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search_tenants": {
        const { search: q } = body;
        if (!q || q.length < 2) {
          return new Response(JSON.stringify({ tenants: [], total: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: byName } = await adminClient
          .from("tenants")
          .select("id")
          .or(`name.ilike.%${q}%,id.ilike.%${q}%,slug.ilike.%${q}%`)
          .limit(50);

        const { data: byEmail } = await adminClient
          .from("profiles")
          .select("user_id")
          .ilike("email", `%${q}%`)
          .limit(50);

        const emailUserIds = (byEmail || []).map((p: any) => p.user_id);
        let emailTenantIds: string[] = [];
        if (emailUserIds.length > 0) {
          const { data: members } = await adminClient
            .from("tenant_members")
            .select("tenant_id")
            .in("user_id", emailUserIds);
          emailTenantIds = (members || []).map((m: any) => m.tenant_id);
        }

        const allIds = [...new Set([
          ...(byName || []).map((t: any) => t.id),
          ...emailTenantIds,
        ])];

        if (allIds.length === 0) {
          return new Response(JSON.stringify({ tenants: [], total: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: tenants, error } = await adminClient
          .from("tenants")
          .select("*")
          .in("id", allIds)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        // Enrich with members + profiles
        const { data: allMembers } = await adminClient
          .from("tenant_members")
          .select("id, user_id, role, tenant_id")
          .in("tenant_id", allIds);

        const enrichedMembers = await enrichMembersWithProfiles(adminClient, allMembers || []);
        const membersByTenant: Record<string, any[]> = {};
        for (const m of enrichedMembers) {
          if (!membersByTenant[m.tenant_id]) membersByTenant[m.tenant_id] = [];
          membersByTenant[m.tenant_id].push(m);
        }

        const enrichedTenants = (tenants || []).map((t: any) => ({
          ...t,
          tenant_members: membersByTenant[t.id] || [],
        }));

        return new Response(JSON.stringify({ tenants: enrichedTenants, total: enrichedTenants.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "extend_trial": {
        if (!isAdmin && !isBillingAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { tenant_id, new_trial_end } = body;
        if (!tenant_id || !new_trial_end) {
          return new Response(JSON.stringify({ error: "Missing tenant_id or new_trial_end" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient
          .from("tenants")
          .update({ trial_ends_at: new_trial_end })
          .eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, userId, "extend_trial", tenant_id, undefined, { new_trial_end });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "change_plan": {
        if (!isAdmin && !isBillingAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { tenant_id, plan } = body;
        if (!tenant_id || !plan) {
          return new Response(JSON.stringify({ error: "Missing tenant_id or plan" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Build comprehensive update payload with manual override flag
        const updatePayload: Record<string, any> = { 
          plan,
          is_manual_override: true, // Mark as admin override so webhooks don't overwrite
          last_synced_at: new Date().toISOString(),
        };

        if (plan !== "trial") {
          updatePayload.stripe_subscription_status = "active";
          updatePayload.stripe_current_period_end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          updatePayload.stripe_subscription_status = null;
          updatePayload.stripe_current_period_end = null;
          updatePayload.stripe_plan_price_id = null;
          updatePayload.stripe_mrr_cents = 0;
        }

        const { error } = await adminClient
          .from("tenants")
          .update(updatePayload)
          .eq("id", tenant_id);
        if (error) throw error;

        console.log(`[ADMIN] Plan changed for tenant ${tenant_id}: ${plan} (manual override)`, updatePayload);
        await auditLog(adminClient, userId, "change_plan", tenant_id, undefined, { plan, is_manual_override: true });
        return new Response(JSON.stringify({ success: true, plan, is_manual_override: true, updated_fields: Object.keys(updatePayload) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_override": {
        if (!isAdmin && !isBillingAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { tenant_id } = body;
        if (!tenant_id) {
          return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Clear the override flag — next Stripe webhook will resync the plan
        const { error } = await adminClient
          .from("tenants")
          .update({ is_manual_override: false, last_synced_at: new Date().toISOString() })
          .eq("id", tenant_id);
        if (error) throw error;

        console.log(`[ADMIN] Manual override removed for tenant ${tenant_id}`);
        await auditLog(adminClient, userId, "remove_override", tenant_id, undefined, {});
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_custom_price": {
        if (!isAdmin && !isBillingAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { tenant_id, custom_price_cents } = body;
        if (!tenant_id) {
          return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient
          .from("tenants")
          .update({ custom_price_cents: custom_price_cents ?? null })
          .eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, userId, "set_custom_price", tenant_id, undefined, { custom_price_cents });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset_password": {
        if (!isAdmin && !isSupportAgent) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { target_user_id, new_password } = body;
        if (!target_user_id || !new_password || new_password.length < 6) {
          return new Response(
            JSON.stringify({ error: "Missing target_user_id or password too short (min 6)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { error } = await adminClient.auth.admin.updateUser(target_user_id, {
          password: new_password,
        });
        if (error) throw error;
        await auditLog(adminClient, userId, "reset_password", undefined, target_user_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "invite_tenant": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { email, password, full_name } = body;
        if (!email || !password || password.length < 6) {
          return new Response(
            JSON.stringify({ error: "Missing email or password too short (min 6)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data: newUser, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || email },
        });
        if (error) throw error;
        await auditLog(adminClient, userId, "invite_tenant", undefined, newUser.user.id, { email });
        return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "assign_admin_role": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { target_user_id, role } = body;
        const validRoles = ["admin", "billing_admin", "support_agent"];
        if (!target_user_id || !validRoles.includes(role)) {
          return new Response(
            JSON.stringify({ error: "Missing target_user_id or invalid role" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { error } = await adminClient
          .from("user_roles")
          .upsert({ user_id: target_user_id, role }, { onConflict: "user_id,role" });
        if (error) throw error;
        await auditLog(adminClient, userId, "assign_admin_role", undefined, target_user_id, { role });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_admin_role": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { target_user_id, role } = body;
        if (!target_user_id || !role) {
          return new Response(JSON.stringify({ error: "Missing params" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", target_user_id)
          .eq("role", role);
        if (error) throw error;
        await auditLog(adminClient, userId, "remove_admin_role", undefined, target_user_id, { role });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_admin_users": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await adminClient
          .from("user_roles")
          .select("*");
        if (error) throw error;
        const enriched = await enrichRolesWithProfiles(adminClient, data || []);
        return new Response(JSON.stringify({ admin_users: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "find_user_by_email": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { email } = body;
        if (!email) {
          return new Response(JSON.stringify({ error: "Missing email" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data } = await adminClient
          .from("profiles")
          .select("user_id, full_name, email")
          .ilike("email", email)
          .limit(5);
        return new Response(JSON.stringify({ users: data || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_tenant_notes": {
        if (!isAdmin && !isBillingAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { tenant_id, notes } = body;
        if (!tenant_id) {
          return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient
          .from("tenants")
          .update({ notes: notes ?? null })
          .eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, userId, "update_tenant_notes", tenant_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "resync_stripe": {
        if (!isAdmin && !isBillingAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { tenant_id } = body;
        if (!tenant_id) {
          return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
          return new Response(JSON.stringify({ error: "Stripe not configured" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        // Get tenant without join
        const { data: tenant } = await adminClient
          .from("tenants")
          .select("id, stripe_customer_id")
          .eq("id", tenant_id)
          .single();

        if (!tenant) {
          return new Response(JSON.stringify({ error: "Tenant not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let customerId = tenant.stripe_customer_id;

        if (!customerId) {
          // Find owner email separately
          const { data: ownerMember } = await adminClient
            .from("tenant_members")
            .select("user_id")
            .eq("tenant_id", tenant_id)
            .eq("role", "owner")
            .limit(1);

          if (ownerMember && ownerMember.length > 0) {
            const { data: ownerProfile } = await adminClient
              .from("profiles")
              .select("email")
              .eq("user_id", ownerMember[0].user_id)
              .single();

            if (ownerProfile?.email) {
              const customers = await stripe.customers.list({ email: ownerProfile.email, limit: 1 });
              if (customers.data.length > 0) {
                customerId = customers.data[0].id;
              }
            }
          }
        }

        if (!customerId) {
          await adminClient.from("tenants").update({
            stripe_subscription_status: null,
            stripe_mrr_cents: 0,
            last_synced_at: new Date().toISOString(),
          }).eq("id", tenant_id);
          await auditLog(adminClient, userId, "resync_stripe", tenant_id, undefined, { result: "no_customer" });
          return new Response(JSON.stringify({ success: true, status: "no_customer_found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Look for active subscription first, then fall back to any subscription
        let subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
        if (subs.data.length === 0) {
          subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
        }
        if (subs.data.length > 0) {
          const sub = subs.data[0];
          const item = sub.items.data[0];
          const mrrCents = item ? (item.price.unit_amount || 0) : 0;

          // Determine plan from price amount (same logic as webhook)
          let plan: string | undefined;
          if (sub.status === "active") {
            const amount = item?.price.unit_amount || 0;
            plan = amount <= 6099 ? "lite" : "full";
          }

          const periodEnd = sub.current_period_end;
          let periodEndIso: string | null = null;
          try {
            if (typeof periodEnd === 'number') {
              periodEndIso = new Date(periodEnd * 1000).toISOString();
            } else if (typeof periodEnd === 'string') {
              periodEndIso = new Date(periodEnd).toISOString();
            }
          } catch (_) {
            periodEndIso = null;
          }

          const updateData: Record<string, any> = {
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            stripe_subscription_status: sub.status,
            stripe_plan_price_id: item?.price.id || null,
            stripe_current_period_end: periodEndIso,
            stripe_mrr_cents: mrrCents,
            last_synced_at: new Date().toISOString(),
          };
          if (plan) updateData.plan = plan;

          await adminClient.from("tenants").update(updateData).eq("id", tenant_id);
        } else {
          await adminClient.from("tenants").update({
            stripe_customer_id: customerId,
            stripe_subscription_status: null,
            stripe_mrr_cents: 0,
            last_synced_at: new Date().toISOString(),
          }).eq("id", tenant_id);
        }

        await auditLog(adminClient, userId, "resync_stripe", tenant_id, undefined, { customer_id: customerId });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_audit_logs": {
        const { tenant_id, limit: logLimit } = body;
        let query = adminClient
          .from("admin_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(logLimit || 100);

        if (tenant_id) {
          query = query.eq("target_tenant_id", tenant_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        const enriched = await enrichLogsWithProfiles(adminClient, data || []);
        return new Response(JSON.stringify({ logs: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "impersonate_tenant": {
        if (!isAdmin && !isSupportAgent) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { tenant_id } = body;
        if (!tenant_id) {
          return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: tenant, error: tErr } = await adminClient
          .from("tenants")
          .select("*")
          .eq("id", tenant_id)
          .single();
        if (tErr || !tenant) {
          return new Response(JSON.stringify({ error: "Tenant not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: rawMembers } = await adminClient
          .from("tenant_members")
          .select("id, user_id, role, created_at")
          .eq("tenant_id", tenant_id);

        const members = await enrichMembersWithProfiles(adminClient, rawMembers || []);

        const { count: eventsCount } = await adminClient
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant_id);

        const { data: recentEvents } = await adminClient
          .from("events")
          .select("id, event_date, event_type, venue, total_price, payment_status, client_id, clients:client_id(name)")
          .eq("tenant_id", tenant_id)
          .order("event_date", { ascending: false })
          .limit(10);

        const { count: invoicesCount } = await adminClient
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant_id);

        const { data: recentInvoices } = await adminClient
          .from("invoices")
          .select("id, amount, status, created_at, clients:client_id(name)")
          .eq("tenant_id", tenant_id)
          .order("created_at", { ascending: false })
          .limit(10);

        const { count: clientsCount } = await adminClient
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant_id);

        await auditLog(adminClient, userId, "impersonate_tenant", tenant_id, undefined, {});

        return new Response(JSON.stringify({
          tenant,
          members,
          eventsCount: eventsCount || 0,
          recentEvents: recentEvents || [],
          invoicesCount: invoicesCount || 0,
          recentInvoices: recentInvoices || [],
          clientsCount: clientsCount || 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_all_users": {
        if (!isAdmin && !isSupportAgent) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { search: userSearch, page = 1, page_size = 50 } = body;
        const offset = (page - 1) * page_size;

        let query = adminClient
          .from("profiles")
          .select("user_id, full_name, email, avatar_url, created_at, phone", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + page_size - 1);

        if (userSearch && userSearch.length >= 2) {
          query = query.or(`full_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`);
        }

        const { data: users, error: usersErr, count } = await query;
        if (usersErr) throw usersErr;

        // Enrich with tenant + subscription info
        const userIds = (users || []).map((u: any) => u.user_id);
        let enrichedUsers = users || [];

        if (userIds.length > 0) {
          const { data: memberships } = await adminClient
            .from("tenant_members")
            .select("user_id, tenant_id, role")
            .in("user_id", userIds);

          const tenantIds = [...new Set((memberships || []).map((m: any) => m.tenant_id))];
          let tenantMap: Record<string, any> = {};
          if (tenantIds.length > 0) {
            const { data: tenants } = await adminClient
              .from("tenants")
              .select("id, name, plan, trial_ends_at, stripe_subscription_status")
              .in("id", tenantIds);
            for (const t of (tenants || [])) {
              tenantMap[t.id] = t;
            }
          }

          const membershipsByUser: Record<string, any[]> = {};
          for (const m of (memberships || [])) {
            if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = [];
            membershipsByUser[m.user_id].push({
              ...m,
              tenant: tenantMap[m.tenant_id] || null,
            });
          }

          enrichedUsers = (users || []).map((u: any) => ({
            ...u,
            memberships: membershipsByUser[u.user_id] || [],
          }));
        }

        return new Response(JSON.stringify({ users: enrichedUsers, total: count || 0, page, page_size }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "deactivate_user": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { target_user_id, ban } = body;
        if (!target_user_id) {
          return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (ban) {
          const { error } = await adminClient.auth.admin.updateUser(target_user_id, {
            ban_duration: "876000h", // ~100 years
          });
          if (error) throw error;
        } else {
          const { error } = await adminClient.auth.admin.updateUser(target_user_id, {
            ban_duration: "none",
          });
          if (error) throw error;
        }
        await auditLog(adminClient, userId, ban ? "deactivate_user" : "activate_user", undefined, target_user_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_user": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { target_user_id } = body;
        if (!target_user_id) {
          return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient.auth.admin.deleteUser(target_user_id);
        if (error) throw error;
        await auditLog(adminClient, userId, "delete_user", undefined, target_user_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_support_tickets": {
        if (!isAdmin && !isSupportAgent) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { status: ticketStatus, page = 1, page_size = 50 } = body;
        const offset = (page - 1) * page_size;

        let query = adminClient
          .from("support_tickets")
          .select("*, tenants:tenant_id(name)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + page_size - 1);

        if (ticketStatus && ticketStatus !== "all") {
          query = query.eq("status", ticketStatus);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        // Enrich with profile data manually (no FK from support_tickets.user_id to profiles)
        const ticketUserIds = [...new Set((data || []).map((t: any) => t.user_id))];
        let profileMap: Record<string, any> = {};
        if (ticketUserIds.length > 0) {
          const { data: profiles } = await adminClient
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", ticketUserIds);
          for (const p of (profiles || [])) {
            profileMap[p.user_id] = p;
          }
        }
        const enrichedTickets = (data || []).map((t: any) => ({
          ...t,
          profiles: profileMap[t.user_id] || null,
        }));

        return new Response(JSON.stringify({ tickets: enrichedTickets, total: count || 0, page, page_size }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_ticket_replies": {
        if (!isAdmin && !isSupportAgent) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { ticket_id } = body;
        if (!ticket_id) {
          return new Response(JSON.stringify({ error: "Missing ticket_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await adminClient
          .from("ticket_replies")
          .select("*")
          .eq("ticket_id", ticket_id)
          .order("created_at", { ascending: true });
        if (error) throw error;

        // Enrich replies with profile data manually
        const replyUserIds = [...new Set((data || []).map((r: any) => r.user_id))];
        let replyProfileMap: Record<string, any> = {};
        if (replyUserIds.length > 0) {
          const { data: profiles } = await adminClient
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", replyUserIds);
          for (const p of (profiles || [])) {
            replyProfileMap[p.user_id] = p;
          }
        }
        const enrichedReplies = (data || []).map((r: any) => ({
          ...r,
          profiles: replyProfileMap[r.user_id] || null,
        }));

        return new Response(JSON.stringify({ replies: enrichedReplies }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reply_to_ticket": {
        if (!isAdmin && !isSupportAgent) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { ticket_id, message } = body;
        if (!ticket_id || !message) {
          return new Response(JSON.stringify({ error: "Missing ticket_id or message" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient
          .from("ticket_replies")
          .insert({ ticket_id, user_id: userId, message, is_admin: true });
        if (error) throw error;
        
        // Update ticket status to in_progress if it was open
        await adminClient
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", ticket_id)
          .eq("status", "open");

        await auditLog(adminClient, userId, "reply_to_ticket", undefined, undefined, { ticket_id });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_ticket_status": {
        if (!isAdmin && !isSupportAgent) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { ticket_id, status: newStatus } = body;
        if (!ticket_id || !newStatus) {
          return new Response(JSON.stringify({ error: "Missing params" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await adminClient
          .from("support_tickets")
          .update({ status: newStatus })
          .eq("id", ticket_id);
        if (error) throw error;
        await auditLog(adminClient, userId, "update_ticket_status", undefined, undefined, { ticket_id, status: newStatus });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_admin_activity": {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await adminClient
          .from("admin_audit_logs")
          .select("admin_user_id, action, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;

        const activityMap: Record<string, { last_action: string; last_active_at: string }> = {};
        for (const row of (data || [])) {
          if (!activityMap[row.admin_user_id]) {
            activityMap[row.admin_user_id] = {
              last_action: row.action,
              last_active_at: row.created_at,
            };
          }
        }

        return new Response(JSON.stringify({ activity: activityMap }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    console.error("[ADMIN] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
