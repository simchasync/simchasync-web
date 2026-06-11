/// <reference path="../_shared/deno-runtime.d.ts" />
import {
  adminCors, getErrorMessage, createAdminClient,
  authenticate, getUserRoles,
  isAdmin, isSupportAgent,
  auditLog,
} from "../_shared/admin-helpers.ts";
import { BAN_DURATION_HOURS } from "../_shared/pricing.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = adminCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const adminClient = createAdminClient();
    const auth = await authenticate(adminClient, req.headers.get("Authorization"));
    if (!auth.user) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userRoles = await getUserRoles(adminClient, auth.user.id);
    if (!isAdmin(userRoles) && !isSupportAgent(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "reset_password": {
        if (!isAdmin(userRoles) && !isSupportAgent(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { target_user_id, new_password } = body;
        if (!target_user_id || !new_password || new_password.length < 6) return new Response(JSON.stringify({ error: "Missing target_user_id or password too short (min 6)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.auth.admin.updateUserById(target_user_id, { password: new_password });
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "reset_password", undefined, target_user_id);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "invite_tenant": {
        if (!isAdmin(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { email, password, full_name } = body;
        if (!email || !password || password.length < 6) return new Response(JSON.stringify({ error: "Missing email or password too short (min 6)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: newUser, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: full_name || email } });
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "invite_tenant", undefined, newUser.user.id, { email });
        return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "deactivate_user": {
        if (!isAdmin(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { target_user_id, ban } = body;
        if (!target_user_id) return new Response(JSON.stringify({ error: "Missing target_user_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.auth.admin.updateUserById(target_user_id, { ban_duration: ban ? BAN_DURATION_HOURS : "none" });
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, ban ? "deactivate_user" : "activate_user", undefined, target_user_id);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "delete_user": {
        if (!isAdmin(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { target_user_id } = body;
        if (!target_user_id) return new Response(JSON.stringify({ error: "Missing target_user_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.auth.admin.deleteUser(target_user_id);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "delete_user", undefined, target_user_id);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list_all_users": {
        const { search: userSearch, page = 1, page_size = 50 } = body;
        const offset = (page - 1) * page_size;
        let query = adminClient.from("profiles").select("user_id, full_name, email, avatar_url, created_at, phone", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + page_size - 1);
        if (userSearch && userSearch.length >= 2) query = query.or(`full_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`);
        const { data: users, error: usersErr, count } = await query;
        if (usersErr) throw usersErr;
        const userIds = (users || []).map((u: any) => u.user_id);
        let enrichedUsers = users || [];
        if (userIds.length > 0) {
          const { data: memberships } = await adminClient.from("tenant_members").select("user_id, tenant_id, role").in("user_id", userIds);
          const tenantIds = [...new Set((memberships || []).map((m: any) => m.tenant_id))];
          const tenantMap: Record<string, any> = {};
          if (tenantIds.length > 0) {
            const { data: tenants } = await adminClient.from("tenants").select("id, name, plan, trial_ends_at, stripe_subscription_status").in("id", tenantIds);
            for (const t of (tenants || [])) tenantMap[t.id] = t;
          }
          const membershipsByUser: Record<string, any[]> = {};
          for (const m of (memberships || [])) { if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = []; membershipsByUser[m.user_id].push({ ...m, tenant: tenantMap[m.tenant_id] || null }); }
          enrichedUsers = (users || []).map((u: any) => ({ ...u, memberships: membershipsByUser[u.user_id] || [] }));
        }
        return new Response(JSON.stringify({ users: enrichedUsers, total: count || 0, page, page_size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
