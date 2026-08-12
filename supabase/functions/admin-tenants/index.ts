/// <reference path="../_shared/deno-runtime.d.ts" />
import {
  adminCors, getErrorMessage, createAdminClient,
  authenticate, getUserRoles, hasAnyRole, requireRoles,
  isAdmin, isBillingAdmin, isSupportAgent,
  auditLog, enrichMembersWithProfiles,
} from "../_shared/admin-helpers.ts";

// Colleagues shown alongside members in the admin tenant view: the address-book
// `colleagues` table plus internal per-booking collaborators (event_colleagues,
// type "internal"), keyed by tenant id.
async function colleaguesByTenant(adminClient: any, tenantIds: string[]): Promise<Record<string, any[]>> {
  const map: Record<string, any[]> = {};
  if (tenantIds.length === 0) return map;

  const { data: book } = await adminClient
    .from("colleagues")
    .select("id, full_name, email, role_instrument, tenant_id")
    .in("tenant_id", tenantIds);
  for (const c of book || []) {
    (map[c.tenant_id] ||= []).push({ id: c.id, kind: "colleague", name: c.full_name, email: c.email, role: c.role_instrument });
  }

  const { data: internal } = await adminClient
    .from("event_colleagues")
    .select("id, name, email, role_instrument, events!inner(tenant_id)")
    .eq("colleague_type", "internal")
    .in("events.tenant_id", tenantIds);
  for (const c of internal || []) {
    const tid = (c.events as any)?.tenant_id;
    if (tid) (map[tid] ||= []).push({ id: c.id, kind: "internal_colleague", name: c.name, email: c.email, role: c.role_instrument });
  }

  return map;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = adminCors(req);
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
      case "list_tenants": {
        const { search, page = 1, page_size = 50 } = body;
        const offset = (page - 1) * page_size;
        let query = adminClient.from("tenants").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + page_size - 1);
        if (search) query = query.ilike("name", `%${search}%`);
        const { data: tenants, error, count } = await query;
        if (error) throw error;
        const tenantIds = (tenants || []).map((t: any) => t.id);
        let enrichedTenants = tenants || [];
        if (tenantIds.length > 0) {
          const { data: allMembers } = await adminClient.from("tenant_members").select("id, user_id, role, tenant_id").in("tenant_id", tenantIds);
          const enrichedMembers = await enrichMembersWithProfiles(adminClient, allMembers || []);
          const membersByTenant: Record<string, any[]> = {};
          for (const m of enrichedMembers) { if (!membersByTenant[m.tenant_id]) membersByTenant[m.tenant_id] = []; membersByTenant[m.tenant_id].push(m); }
          const collByTenant = await colleaguesByTenant(adminClient, tenantIds);
          enrichedTenants = (tenants || []).map((t: any) => ({ ...t, tenant_members: membersByTenant[t.id] || [], colleagues: collByTenant[t.id] || [] }));
        }
        return new Response(JSON.stringify({ tenants: enrichedTenants, total: count || 0, page, page_size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "search_tenants": {
        const { search: q } = body;
        if (!q || q.length < 2) return new Response(JSON.stringify({ tenants: [], total: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: byName } = await adminClient.from("tenants").select("id").or(`name.ilike.%${q}%,id.ilike.%${q}%,slug.ilike.%${q}%`).limit(50);
        const { data: byEmail } = await adminClient.from("profiles").select("user_id").ilike("email", `%${q}%`).limit(50);
        const emailUserIds = (byEmail || []).map((p: any) => p.user_id);
        let emailTenantIds: string[] = [];
        if (emailUserIds.length > 0) {
          const { data: members } = await adminClient.from("tenant_members").select("tenant_id").in("user_id", emailUserIds);
          emailTenantIds = (members || []).map((m: any) => m.tenant_id);
        }
        const allIds = [...new Set([...(byName || []).map((t: any) => t.id), ...emailTenantIds])];
        if (allIds.length === 0) return new Response(JSON.stringify({ tenants: [], total: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: tenants, error } = await adminClient.from("tenants").select("*").in("id", allIds).order("created_at", { ascending: false }).limit(50);
        if (error) throw error;
        const { data: allMembers } = await adminClient.from("tenant_members").select("id, user_id, role, tenant_id").in("tenant_id", allIds);
        const enrichedMembers = await enrichMembersWithProfiles(adminClient, allMembers || []);
        const membersByTenant: Record<string, any[]> = {};
        for (const m of enrichedMembers) { if (!membersByTenant[m.tenant_id]) membersByTenant[m.tenant_id] = []; membersByTenant[m.tenant_id].push(m); }
        const collByTenant = await colleaguesByTenant(adminClient, allIds);
        const enrichedTenants = (tenants || []).map((t: any) => ({ ...t, tenant_members: membersByTenant[t.id] || [], colleagues: collByTenant[t.id] || [] }));
        return new Response(JSON.stringify({ tenants: enrichedTenants, total: enrichedTenants.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update_tenant_notes": {
        if (!isAdmin(userRoles) && !isBillingAdmin(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { tenant_id, notes } = body;
        if (!tenant_id) return new Response(JSON.stringify({ error: "Missing tenant_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("tenants").update({ notes: notes ?? null }).eq("id", tenant_id);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "update_tenant_notes", tenant_id);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "impersonate_tenant": {
        if (!isAdmin(userRoles) && !isSupportAgent(userRoles)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { tenant_id } = body;
        if (!tenant_id) return new Response(JSON.stringify({ error: "Missing tenant_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: tenant, error: tErr } = await adminClient.from("tenants").select("*").eq("id", tenant_id).single();
        if (tErr || !tenant) return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: rawMembers } = await adminClient.from("tenant_members").select("id, user_id, role, created_at").eq("tenant_id", tenant_id);
        const members = await enrichMembersWithProfiles(adminClient, rawMembers || []);
        const { count: eventsCount } = await adminClient.from("events").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id);
        const { data: recentEvents } = await adminClient.from("events").select("id, event_date, event_type, venue, total_price, payment_status, client_id, clients:client_id(name)").eq("tenant_id", tenant_id).order("event_date", { ascending: false }).limit(10);
        const { count: invoicesCount } = await adminClient.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id);
        const { data: recentInvoices } = await adminClient.from("invoices").select("id, amount, status, created_at, clients:client_id(name)").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(10);
        const { count: clientsCount } = await adminClient.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id);
        await auditLog(adminClient, auth.user.id, "impersonate_tenant", tenant_id);
        return new Response(JSON.stringify({ tenant, members, eventsCount: eventsCount || 0, recentEvents: recentEvents || [], invoicesCount: invoicesCount || 0, recentInvoices: recentInvoices || [], clientsCount: clientsCount || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
