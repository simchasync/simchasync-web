/// <reference path="../_shared/deno-runtime.d.ts" />
import {
  corsHeaders, getErrorMessage, createAdminClient,
  authenticate, getUserRoles, hasAnyRole,
  enrichLogsWithProfiles,
} from "../_shared/admin-helpers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const adminClient = createAdminClient();
    const auth = await authenticate(adminClient, req.headers.get("Authorization"));
    if (!auth.user) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userRoles = await getUserRoles(adminClient, auth.user.id);
    if (!hasAnyRole(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "list_audit_logs": {
        const { tenant_id, limit: logLimit } = body;
        let query = adminClient.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(logLimit || 100);
        if (tenant_id) query = query.eq("target_tenant_id", tenant_id);
        const { data, error } = await query;
        if (error) throw error;
        const enriched = await enrichLogsWithProfiles(adminClient, data || []);
        return new Response(JSON.stringify({ logs: enriched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
