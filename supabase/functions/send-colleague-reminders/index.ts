/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { emailShell, escapeHtml, getAppOrigin, sendBrandedEmail } from "../_shared/brandedEmail.ts";

const COLLEAGUE_REMINDER_SECRET = Deno.env.get("COLLEAGUE_REMINDER_SECRET") ?? "";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = req.headers.get("authorization");
  if (!COLLEAGUE_REMINDER_SECRET || auth !== `Bearer ${COLLEAGUE_REMINDER_SECRET}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("APP_SECRET_API_KEY")!);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const appOrigin = getAppOrigin(req);

    const { data: pending, error: pendingError } = await admin
      .from("event_colleagues")
      .select("id, email, name, role_instrument, price, events!inner(tenant_id, event_type, event_date, venue)")
      .eq("invite_status", "pending")
      .lte("created_at", cutoff)
      .is("reminder_sent_at", null);
    if (pendingError) throw pendingError;

    let remindedCount = 0;

    for (const ec of pending ?? []) {
      if (!ec.email) continue;
      const event = ec.events as any;
      const tenantId = event.tenant_id as string;

      const { data: tenant } = await admin.from("tenants").select("name").eq("id", tenantId).single();
      const workspaceName = escapeHtml(tenant?.name || "A SimchaSync workspace");
      const roleLabel = escapeHtml(ec.role_instrument || "Colleague");
      const eventLine = [
        event.event_type ? `Event: <strong>${escapeHtml(event.event_type)}</strong>` : "",
        event.event_date ? `Date: <strong>${escapeHtml(event.event_date)}</strong>` : "",
        event.venue ? `Venue: <strong>${escapeHtml(event.venue)}</strong>` : "",
        ec.price ? `Your fee: <strong>$${Number(ec.price).toLocaleString()}</strong>` : "",
      ].filter(Boolean).join("<br>");

      try {
        await sendBrandedEmail(
          String(ec.email).trim().toLowerCase(),
          `Reminder: ${workspaceName} added you to a booking`,
          emailShell(
            `Reminder: ${workspaceName} added you to a booking`,
            `<p>You've been assigned as <strong>${roleLabel}</strong> and haven't responded yet.</p><p>${eventLine}</p><p>Open your dashboard to see the full booking details.</p>`,
            "Open Your Bookings",
            `${appOrigin}/app/bookings`,
          ),
        );
      } catch (emailErr) {
        console.error("Colleague reminder email failed:", emailErr);
        continue;
      }

      await admin
        .from("event_colleagues")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", ec.id);
      remindedCount++;
    }

    return json({ success: true, reminded: remindedCount });
  } catch (err) {
    console.error("send-colleague-reminders error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
