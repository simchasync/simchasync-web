/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";

function getAppUrl(): string {
  return Deno.env.get("APP_URL") ?? "https://simchasync-web.vercel.app";
}

function getResendFrom(): string {
  return Deno.env.get("RESEND_FROM") ?? "SimchaSync <onboarding@resend.dev>";
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY"))!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, Deno.env.get("APP_SECRET_API_KEY")!);

    const { type, tenant_id, event_id, invoice_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: memberCheck } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .eq("invitation_status", "accepted")
      .in("role", ["owner", "booking_manager"])
      .single();

    if (!memberCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: not authorized for this workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let toEmail: string | null = null;
    const { data: ownerMember } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .eq("role", "owner")
      .single();

    if (ownerMember) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", ownerMember.user_id)
        .single();
      toEmail = profile?.email ?? null;
    }

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "No recipient email found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailSubject = "SimchaSync Notification";
    let emailHtml = "";
    const appUrl = getAppUrl();

    switch (type) {
      case "booking_created": {
        const { data: event } = await supabase
          .from("events")
          .select("*, clients(name)")
          .eq("id", event_id)
          .eq("tenant_id", tenant_id)
          .single();
        if (!event) break;
        emailSubject = `New Booking: ${event.event_type || "Event"} on ${event.event_date}`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">New Booking Created</h2>
            <p>A new <strong>${event.event_type}</strong> has been booked for <strong>${event.event_date}</strong>.</p>
            ${event.clients?.name ? `<p>Client: <strong>${event.clients.name}</strong></p>` : ""}
            ${event.venue ? `<p>Venue: ${event.venue}</p>` : ""}
            <p style="margin-top: 20px;"><a href="${appUrl}/app/bookings" style="background: #d4af37; color: #1a1a2e; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Booking</a></p>
          </div>`;
        break;
      }
      case "invoice_sent": {
        emailSubject = "Invoice Sent";
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Invoice Sent</h2>
            <p>An invoice has been sent to the client.</p>
            <p><a href="${appUrl}/app/invoices" style="background: #d4af37; color: #1a1a2e; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Invoices</a></p>
          </div>`;
        break;
      }
      case "invoice_paid": {
        emailSubject = "Payment Received! 🎉";
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Payment Received</h2>
            <p>Great news! An invoice has been paid.</p>
            <p><a href="${appUrl}/app/invoices" style="background: #d4af37; color: #1a1a2e; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Invoices</a></p>
          </div>`;
        break;
      }
      case "booking_reminder": {
        const { data: event } = await supabase
          .from("events")
          .select("*, clients(name)")
          .eq("id", event_id)
          .eq("tenant_id", tenant_id)
          .single();
        if (!event) break;
        emailSubject = `Reminder: ${event.event_type || "Event"} tomorrow (${event.event_date})`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Booking Reminder</h2>
            <p>You have a <strong>${event.event_type}</strong> tomorrow, <strong>${event.event_date}</strong>.</p>
            ${event.venue ? `<p>Venue: ${event.venue}</p>` : ""}
            <p><a href="${appUrl}/app/bookings" style="background: #d4af37; color: #1a1a2e; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details</a></p>
          </div>`;
        break;
      }
      default:
        emailHtml = `<p>Notification from SimchaSync</p>`;
    }

    if (!emailHtml) {
      return new Response(JSON.stringify({ error: "Could not build email content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getResendFrom(),
        to: toEmail,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      if (resendRes.status === 403 && resendData?.name === "validation_error") {
        return new Response(JSON.stringify({ success: false, warning: "Email skipped — Resend sandbox mode." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-notification-email error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
