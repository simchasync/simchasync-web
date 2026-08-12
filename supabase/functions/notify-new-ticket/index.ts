/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { emailShell, escapeHtml, getAppOrigin, sendBrandedEmail } from "../_shared/brandedEmail.ts";

// Emails the support team when a customer submits a new ticket. Called by the app
// right after the ticket is inserted. The caller must own the ticket.
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: Record<string, unknown>, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY"))!;
    const admin = createClient(supabaseUrl, Deno.env.get("APP_SECRET_API_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await caller.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    const { ticket_id } = await req.json().catch(() => ({}));
    if (!ticket_id) return json({ error: "Missing ticket_id" }, 400);

    const { data: ticket } = await admin
      .from("support_tickets")
      .select("subject, description, priority, user_id, tenant_id")
      .eq("id", ticket_id)
      .single();
    if (!ticket || ticket.user_id !== callerId) return json({ error: "Ticket not found" }, 404);

    const { data: profile } = await admin.from("profiles").select("full_name, email").eq("user_id", ticket.user_id).maybeSingle();
    const { data: tenant } = await admin.from("tenants").select("name").eq("id", ticket.tenant_id).maybeSingle();

    const notifyTo = Deno.env.get("SUPPORT_NOTIFY_EMAIL") ?? "simchasync@gmail.com";
    await sendBrandedEmail(
      notifyTo,
      `New support ticket: ${ticket.subject}`,
      emailShell(
        "New support ticket received",
        `<p><strong>${escapeHtml(profile?.full_name || profile?.email || "A user")}</strong>${tenant?.name ? ` (${escapeHtml(tenant.name)})` : ""} submitted a support ticket.</p>` +
        `<p>Subject: <strong>${escapeHtml(ticket.subject)}</strong>${ticket.priority ? ` &middot; Priority: ${escapeHtml(String(ticket.priority))}` : ""}</p>` +
        (ticket.description
          ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #c9a227;background-color:#faf8f4;color:#555566;">${escapeHtml(String(ticket.description))}</blockquote>`
          : "") +
        `<p>Reply-to: <strong>${escapeHtml(profile?.email || "—")}</strong></p>`,
        "Open SimchaSync",
        getAppOrigin(req),
      ),
    );

    return json({ success: true });
  } catch (err) {
    console.error("notify-new-ticket error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
