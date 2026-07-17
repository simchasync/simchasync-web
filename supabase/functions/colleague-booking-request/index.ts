/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ValidationError, parseBody } from "../_shared/validation.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { emailShell, escapeHtml, getAppOrigin, sendBrandedEmail } from "../_shared/brandedEmail.ts";

const bodySchema = z.object({
  event_colleague_id: z.string().uuid("event_colleague_id must be a valid UUID"),
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY"))!;
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

    // Idempotency: this assignment already produced a booking request —
    // don't create a duplicate in the colleague's dashboard or re-email them.
    if (ec.booking_request_id) {
      return jsonResponse({
        success: true,
        already_sent: true,
        existing_user: true,
        request_created: false,
        email_sent: false,
      });
    }

    const email = String(ec.email).trim().toLowerCase();

    const { data: sourceTenant } = await admin.from("tenants").select("name").eq("id", sourceTenantId).single();
    const sourceName = escapeHtml(sourceTenant?.name || "A SimchaSync workspace");
    const appOrigin = getAppOrigin(req);
    const roleLabel = escapeHtml(ec.role_instrument || "Colleague");
    const eventLine = [
      event.event_type ? `Event: <strong>${escapeHtml(event.event_type)}</strong>` : "",
      event.event_date ? `Date: <strong>${escapeHtml(event.event_date)}</strong>` : "",
      event.venue ? `Venue: <strong>${escapeHtml(event.venue)}</strong>` : "",
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
        await sendBrandedEmail(
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
        console.error("Booking-request email failed:", emailErr);
        emailSent = false;
      }

      return jsonResponse({
        success: true,
        existing_user: true,
        request_created: requestCreated,
        email_sent: emailSent,
      });
    }

    // No platform account — create one via invite link (no Supabase email)
    // and send a branded join invite via Resend or nodemailer/Gmail SMTP
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
      await sendBrandedEmail(
        email,
        `${sourceName} wants to work with you on SimchaSync`,
        emailShell(
          `${sourceName} wants to book you${ec.name ? `, ${escapeHtml(ec.name)}` : ""}!`,
          `<p>They'd like you as <strong>${roleLabel}</strong>.</p><p>${eventLine}</p><p>SimchaSync is the event management platform for music professionals. Create your free account to receive and manage booking requests like this one.</p>`,
          "Join SimchaSync",
          inviteLinkData.properties.action_link,
        ),
      );
    } catch (emailErr) {
      console.error("Join-invite email failed:", emailErr);
      emailSent = false;
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
