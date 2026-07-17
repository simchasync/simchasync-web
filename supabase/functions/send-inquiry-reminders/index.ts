/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { emailShell, escapeHtml, getAppOrigin, sendBrandedEmail } from "../_shared/brandedEmail.ts";

const INQUIRY_REMINDER_SECRET = Deno.env.get("INQUIRY_REMINDER_SECRET") ?? "";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = req.headers.get("authorization");
  if (!INQUIRY_REMINDER_SECRET || auth !== `Bearer ${INQUIRY_REMINDER_SECRET}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("APP_SECRET_API_KEY")!);
    const today = new Date().toISOString().slice(0, 10);

    const { data: due, error: dueError } = await admin
      .from("booking_requests")
      .select("id, tenant_id, name, event_type, event_date")
      .lte("follow_up_date", today)
      .is("follow_up_reminded_at", null)
      .not("status", "in", "(booked,declined)");
    if (dueError) throw dueError;

    let remindedCount = 0;
    const appOrigin = getAppOrigin(req);

    for (const inquiry of due ?? []) {
      const { data: members } = await admin
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", inquiry.tenant_id)
        .in("role", ["owner", "booking_manager"])
        .eq("invitation_status", "accepted");

      const userIds = (members ?? []).map((m) => m.user_id);
      if (userIds.length === 0) continue;

      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);

      const eventLine = [
        inquiry.event_type ? `Event: <strong>${escapeHtml(inquiry.event_type)}</strong>` : "",
        inquiry.event_date ? `Date: <strong>${escapeHtml(inquiry.event_date)}</strong>` : "",
      ].filter(Boolean).join("<br>");

      for (const userId of userIds) {
        await admin.from("notifications").insert({
          tenant_id: inquiry.tenant_id,
          user_id: userId,
          title: "Follow-up reminder",
          message: `Follow up with ${inquiry.name}`,
          type: "inquiry",
          link: "/app/inquiries",
        });

        const email = (profiles ?? []).find((p) => p.user_id === userId)?.email;
        if (email) {
          try {
            await sendBrandedEmail(
              email,
              `Follow-up reminder: ${inquiry.name}`,
              emailShell(
                "Time to follow up",
                `<p>You set a follow-up reminder for <strong>${escapeHtml(inquiry.name)}</strong>.</p><p>${eventLine}</p>`,
                "Open Inquiries",
                `${appOrigin}/app/inquiries`,
              ),
            );
          } catch (emailErr) {
            console.error("Inquiry reminder email failed:", emailErr);
          }
        }
      }

      await admin
        .from("booking_requests")
        .update({ follow_up_reminded_at: new Date().toISOString() })
        .eq("id", inquiry.id);
      remindedCount++;
    }

    return json({ success: true, reminded: remindedCount });
  } catch (err) {
    console.error("send-inquiry-reminders error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
