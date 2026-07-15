/// <reference path="../_shared/deno-runtime.d.ts" />
import {
  adminCors, getErrorMessage, createAdminClient,
  authenticate, getUserRoles,
  isAdmin, isSupportAgent,
  auditLog,
} from "../_shared/admin-helpers.ts";
import { emailShell, escapeHtml, getAppOrigin, sendBrandedEmail } from "../_shared/brandedEmail.ts";

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
      case "list_support_tickets": {
        const { status: ticketStatus, page = 1, page_size = 50 } = body;
        const offset = (page - 1) * page_size;
        let query = adminClient.from("support_tickets").select("*, tenants:tenant_id(name)", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + page_size - 1);
        if (ticketStatus && ticketStatus !== "all") query = query.eq("status", ticketStatus);
        const { data, error, count } = await query;
        if (error) throw error;
        const ticketUserIds = [...new Set((data || []).map((t: any) => t.user_id))];
        const profileMap: Record<string, any> = {};
        if (ticketUserIds.length > 0) {
          const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name, email").in("user_id", ticketUserIds);
          for (const p of (profiles || [])) profileMap[p.user_id] = p;
        }
        const enrichedTickets = (data || []).map((t: any) => ({ ...t, profiles: profileMap[t.user_id] || null }));
        return new Response(JSON.stringify({ tickets: enrichedTickets, total: count || 0, page, page_size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get_ticket_replies": {
        const { ticket_id } = body;
        if (!ticket_id) return new Response(JSON.stringify({ error: "Missing ticket_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data, error } = await adminClient.from("ticket_replies").select("*").eq("ticket_id", ticket_id).order("created_at", { ascending: true });
        if (error) throw error;
        const replyUserIds = [...new Set((data || []).map((r: any) => r.user_id))];
        const replyProfileMap: Record<string, any> = {};
        if (replyUserIds.length > 0) {
          const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name, email").in("user_id", replyUserIds);
          for (const p of (profiles || [])) replyProfileMap[p.user_id] = p;
        }
        const enrichedReplies = (data || []).map((r: any) => ({ ...r, profiles: replyProfileMap[r.user_id] || null }));
        return new Response(JSON.stringify({ replies: enrichedReplies }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "reply_to_ticket": {
        const { ticket_id, message } = body;
        if (!ticket_id || !message) return new Response(JSON.stringify({ error: "Missing ticket_id or message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("ticket_replies").insert({ ticket_id, user_id: auth.user.id, message, is_admin: true });
        if (error) throw error;
        await adminClient.from("support_tickets").update({ status: "in_progress" }).eq("id", ticket_id).eq("status", "open");
        await auditLog(adminClient, auth.user.id, "reply_to_ticket", undefined, undefined, { ticket_id });

        // Tell the ticket owner. Never fatal — the reply is already committed, so a mail
        // outage must not turn a successful reply into a 500 for the admin.
        let notified = false;
        let emailSent = false;
        try {
          const { data: ticket } = await adminClient
            .from("support_tickets")
            .select("subject, tenant_id, user_id")
            .eq("id", ticket_id)
            .single();

          if (ticket) {
            await adminClient.from("notifications").insert({
              tenant_id: ticket.tenant_id,
              user_id: ticket.user_id,
              title: "Support replied to your ticket",
              message: ticket.subject,
              type: "support",
              link: "/app/support",
            });
            notified = true;

            const { data: profile } = await adminClient
              .from("profiles")
              .select("email")
              .eq("user_id", ticket.user_id)
              .maybeSingle();

            if (profile?.email) {
              const appOrigin = getAppOrigin(req);
              await sendBrandedEmail(
                profile.email,
                `Re: ${ticket.subject}`,
                emailShell(
                  "SimchaSync Support replied",
                  `<p>We've replied to your ticket <strong>${escapeHtml(ticket.subject)}</strong>:</p>` +
                  `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #c9a227;background-color:#faf8f4;color:#555566;">${escapeHtml(message)}</blockquote>` +
                  `<p>Open your dashboard to read the full conversation or reply.</p>`,
                  "View Ticket",
                  `${appOrigin}/app/support`,
                ),
              );
              emailSent = true;
            }
          }
        } catch (notifyErr) {
          console.error("[admin-support] reply notification failed:", notifyErr);
        }

        return new Response(JSON.stringify({ success: true, notified, email_sent: emailSent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update_ticket_status": {
        const { ticket_id, status: newStatus } = body;
        if (!ticket_id || !newStatus) return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await adminClient.from("support_tickets").update({ status: newStatus }).eq("id", ticket_id);
        if (error) throw error;
        await auditLog(adminClient, auth.user.id, "update_ticket_status", undefined, undefined, { ticket_id, status: newStatus });
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
