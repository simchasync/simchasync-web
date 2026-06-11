/// <reference path="../_shared/deno-runtime.d.ts" />
import {
  adminCors, getErrorMessage, createAdminClient,
  authenticate, getUserRoles, isAdmin,
  auditLog, enrichRolesWithProfiles,
} from "../_shared/admin-helpers.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = adminCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const adminClient = createAdminClient();
    const auth = await authenticate(adminClient, req.headers.get("Authorization"));
    if (!auth.user) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userRoles = await getUserRoles(adminClient, auth.user.id);
    if (!isAdmin(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "assign_admin_role": {
        const { target_user_id, role } = body;
        const validRoles = ["admin", "billing_admin", "support_agent"];
        if (!target_user_id || !validRoles.includes(role)) return new Response(JSON.stringify({ error: "Missing target_user_id or invalid role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("user_roles").upsert({ user_id: target_user_id, role }, { onConflict: "user_id,role" });
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "assign_admin_role", undefined, target_user_id, { role });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "remove_admin_role": {
        const { target_user_id, role } = body;
        if (!target_user_id || !role) return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("user_roles").delete().eq("user_id", target_user_id).eq("role", role);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "remove_admin_role", undefined, target_user_id, { role });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list_admin_users": {
        const { data, error } = await adminClient.from("user_roles").select("*");
        if (error) throw error;
        const enriched = await enrichRolesWithProfiles(adminClient, data || []);
        return new Response(JSON.stringify({ admin_users: enriched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "find_user_by_email": {
        const { email } = body;
        if (!email) return new Response(JSON.stringify({ error: "Missing email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await adminClient.from("profiles").select("user_id, full_name, email").ilike("email", email).limit(5);
        return new Response(JSON.stringify({ users: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list_admin_activity": {
        const { data, error } = await adminClient.from("admin_audit_logs").select("admin_user_id, action, created_at").order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        const activityMap: Record<string, { last_action: string; last_active_at: string }> = {};
        for (const row of (data || [])) { if (!activityMap[row.admin_user_id]) activityMap[row.admin_user_id] = { last_action: row.action, last_active_at: row.created_at }; }
        return new Response(JSON.stringify({ activity: activityMap }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
