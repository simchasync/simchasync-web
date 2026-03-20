import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, tenant_id, event_id, invoice_id, recipient_email, subject, body_html } = await req.json();

    let toEmail = recipient_email;
    if (!toEmail && tenant_id) {
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
        toEmail = profile?.email;
      }
    }

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "No recipient email found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailSubject = subject || "SimchaSync Notification";
    let emailHtml = body_html || "";

    if (!body_html) {
      const appUrl = "https://id-preview--d0c4f6a4-4f55-4082-83e5-75fea084594c.lovable.app";
      switch (type) {
        case "booking_created": {
          const { data: event } = await supabase
            .from("events")
            .select("*, clients(name)")
            .eq("id", event_id)
            .single();
          emailSubject = `New Booking: ${event?.event_type || "Event"} on ${event?.event_date}`;
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">New Booking Created</h2>
              <p>A new <strong>${event?.event_type}</strong> has been booked for <strong>${event?.event_date}</strong>.</p>
              ${event?.clients?.name ? `<p>Client: <strong>${event.clients.name}</strong></p>` : ""}
              ${event?.venue ? `<p>Venue: ${event.venue}</p>` : ""}
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
            .single();
          emailSubject = `Reminder: ${event?.event_type || "Event"} tomorrow (${event?.event_date})`;
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">Booking Reminder</h2>
              <p>You have a <strong>${event?.event_type}</strong> tomorrow, <strong>${event?.event_date}</strong>.</p>
              ${event?.venue ? `<p>Venue: ${event.venue}</p>` : ""}
              <p><a href="${appUrl}/app/bookings" style="background: #d4af37; color: #1a1a2e; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details</a></p>
            </div>`;
          break;
        }
        default:
          emailHtml = `<p>${type || "Notification from SimchaSync"}</p>`;
      }
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SimchaSync <onboarding@resend.dev>",
        to: toEmail,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      if (resendRes.status === 403 && resendData?.name === "validation_error") {
        console.warn("Resend sandbox: cannot send to external recipients.");
        return new Response(JSON.stringify({ success: false, warning: "Email skipped — Resend sandbox mode." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to send email", details: resendData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-notification-email error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
