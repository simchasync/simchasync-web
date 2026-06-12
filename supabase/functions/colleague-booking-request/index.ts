/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ValidationError, parseBody } from "../_shared/validation.ts";

const bodySchema = z.object({
  event_colleague_id: z.string().uuid("event_colleague_id must be a valid UUID"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAppOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  return Deno.env.get("APP_URL") ?? "https://simchasync-web.vercel.app";
}

function emailShell(title: string, bodyHtml: string, buttonLabel: string, buttonUrl: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f4;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;border:1px solid #eee5d8;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#c9a227,#e6c34a);height:6px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:36px 40px 0;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#1a1a2e;letter-spacing:0.5px;">🎵 SimchaSync</p>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <h1 style="margin:0;font-size:20px;color:#1a1a2e;text-align:center;">${title}</h1>
        <div style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#555566;">${bodyHtml}</div>
      </td></tr>
      <tr><td style="padding:28px 40px;text-align:center;">
        <a href="${buttonUrl}" style="display:inline-block;background:linear-gradient(135deg,#c9a227,#e6c34a);color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 36px;border-radius:10px;">${buttonLabel}</a>
      </td></tr>
      <tr><td style="padding:0 40px 32px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#999aa6;text-align:center;">If you weren't expecting this email, you can safely ignore it.</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#b5b6c0;">Sent by SimchaSync · Event management for music professionals</p>
  </td></tr>
</table>`;
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const siteName = Deno.env.get("SITE_NAME") ?? "SimchaSync";
  const from = Deno.env.get("RESEND_FROM") ?? `${siteName} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

/** Fallback when Resend can't deliver: magic sign-in link through Supabase
 * Auth's built-in mailer (custom SMTP). The user always exists by this point. */
async function sendFallbackAuthEmail(supabaseUrl: string, anonKey: string, email: string, redirectTo: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: false, email_redirect_to: redirectTo }),
  });
  if (!response.ok) throw new Error(`Fallback auth email failed: ${await response.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, Deno.env.get("APP_SECRET_API_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return jsonResponse({ error: "Unauthorized" }, 401);
    const callerId = claimsData.claims.sub as string;

    const { event_colleague_id } = parseBody(bodySchema, await req.json());

    // Load the colleague assignment + its event (source of truth — nothing trusted from the client)
    const { data: ec, error: ecError } = await admin
      .from("event_colleagues")
      .select("id, email, name, role_instrument, price, booking_request_id, events!inner(id, tenant_id, event_date, event_type, venue, location, notes)")
      .eq("id", event_colleague_id)
      .single();
    if (ecError || !ec) return jsonResponse({ error: "Colleague assignment not found" }, 404);

    const event = ec.events as any;
    const sourceTenantId = event.tenant_id as string;

    // Caller must be a writer in the event's workspace
    const { data: membership } = await admin
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", sourceTenantId)
      .eq("user_id", callerId)
      .in("role", ["owner", "booking_manager"])
      .maybeSingle();
    if (!membership) return jsonResponse({ error: "Forbidden" }, 403);

    if (!ec.email) return jsonResponse({ success: true, skipped: "no_email" });
    const email = String(ec.email).trim().toLowerCase();

    const { data: sourceTenant } = await admin.from("tenants").select("name").eq("id", sourceTenantId).single();
    const sourceName = sourceTenant?.name || "A SimchaSync workspace";
    const appOrigin = getAppOrigin(req);
    const roleLabel = ec.role_instrument || "Colleague";
    const eventLine = [
      event.event_type ? `Event: <strong>${event.event_type}</strong>` : "",
      event.event_date ? `Date: <strong>${event.event_date}</strong>` : "",
      event.venue ? `Venue: <strong>${event.venue}</strong>` : "",
      ec.price ? `Offered: <strong>$${Number(ec.price).toLocaleString()}</strong>` : "",
    ].filter(Boolean).join("<br>");

    // Does this email belong to a platform user?
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();
    if (usersError) throw usersError;
    const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email);

    if (existingUser) {
      // Their workspace (if any)
      const { data: extTenantId } = await admin.rpc("get_user_tenant_id", { _user_id: existingUser.id });

      let requestCreated = false;
      if (extTenantId) {
        const { data: brRow, error: brError } = await admin
          .from("booking_requests")
          .insert({
            tenant_id: extTenantId,
            name: sourceName,
            email,
            phone: null,
            event_date: event.event_date || null,
            event_type: event.event_type || "wedding",
            message: `Incoming booking request from ${sourceName} — Role: ${roleLabel}${event.venue ? `, Venue: ${event.venue}` : ""}${event.notes ? `\n\nNotes: ${event.notes}` : ""}`,
            status: "new",
            source_event_id: event.id,
            source_tenant_id: sourceTenantId,
            source_colleague_id: ec.id,
            price: ec.price || null,
          } as never)
          .select("id")
          .single();

        if (!brError && brRow) {
          requestCreated = true;
          await admin.from("event_colleagues").update({ booking_request_id: brRow.id } as never).eq("id", ec.id);
          await admin.from("notifications").insert({
            tenant_id: extTenantId,
            user_id: existingUser.id,
            title: "Incoming Booking Request",
            message: `${sourceName} sent you a booking request as ${roleLabel} for ${event.event_type || "an event"} on ${event.event_date || "TBD"}`,
            type: "booking",
            link: "/app/bookings",
          });
        } else if (brError) {
          console.error("booking_requests insert failed:", brError);
        }
      }

      let emailSent = true;
      try {
        await sendResendEmail(
          email,
          `New booking request from ${sourceName}`,
          emailShell(
            `${sourceName} sent you a booking request`,
            `<p>You've been requested as <strong>${roleLabel}</strong>.</p><p>${eventLine}</p><p>${requestCreated ? "Open your dashboard to accept or decline the request." : "Log in to SimchaSync to view the details."}</p>`,
            "Open Your Dashboard",
            `${appOrigin}/app/bookings`,
          ),
        );
      } catch (emailErr) {
        console.error("Resend failed, trying built-in mailer:", emailErr);
        try {
          await sendFallbackAuthEmail(supabaseUrl, anonKey, email, `${appOrigin}/app/bookings`);
        } catch (fallbackErr) {
          console.error("Fallback email also failed:", fallbackErr);
          emailSent = false;
        }
      }

      return jsonResponse({
        success: true,
        existing_user: true,
        request_created: requestCreated,
        email_sent: emailSent,
      });
    }

    // No platform account — create one via invite link (no Supabase email) and send a branded join invite
    const { data: inviteLinkData, error: inviteErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${appOrigin}/reset-password`,
        data: { invited_as_colleague_by: sourceName, full_name: ec.name || undefined },
      },
    });
    if (inviteErr) throw inviteErr;

    let emailSent = true;
    try {
      await sendResendEmail(
        email,
        `${sourceName} wants to work with you on SimchaSync`,
        emailShell(
          `${sourceName} wants to book you${ec.name ? `, ${ec.name}` : ""}!`,
          `<p>They'd like you as <strong>${roleLabel}</strong>.</p><p>${eventLine}</p><p>SimchaSync is the event management platform for music professionals. Create your free account to receive and manage booking requests like this one.</p>`,
          "Join SimchaSync",
          inviteLinkData.properties.action_link,
        ),
      );
    } catch (emailErr) {
      console.error("Resend failed, trying built-in mailer:", emailErr);
      try {
        await sendFallbackAuthEmail(supabaseUrl, anonKey, email, `${appOrigin}/reset-password`);
      } catch (fallbackErr) {
        console.error("Fallback email also failed:", fallbackErr);
        emailSent = false;
      }
    }

    return jsonResponse({
      success: true,
      existing_user: false,
      platform_invite: true,
      email_sent: emailSent,
    });
  } catch (err) {
    console.error("colleague-booking-request error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      err instanceof ValidationError ? 400 : 500,
    );
  }
});
