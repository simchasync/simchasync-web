/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ValidationError, parseBody } from "../_shared/validation.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { emailShell, getAppOrigin, sendBrandedEmail } from "../_shared/brandedEmail.ts";

const bodySchema = z.object({
  event_colleague_id: z.string().uuid("event_colleague_id must be a valid UUID"),
});

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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

    // Source of truth — nothing trusted from the client
    const { data: ec, error: ecError } = await admin
      .from("event_colleagues")
      .select("id, email, name, role_instrument, price, events!inner(id, tenant_id, event_date, event_type, venue, location, notes)")
      .eq("id", event_colleague_id)
      .single();
    if (ecError || !ec) return jsonResponse({ error: "Colleague assignment not found" }, 404);

    const event = ec.events as any;
    const tenantId = event.tenant_id as string;

    // Caller must be a writer in the event's workspace
    const { data: membership } = await admin
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", callerId)
      .in("role", ["owner", "booking_manager"])
      .maybeSingle();
    if (!membership) return jsonResponse({ error: "Forbidden" }, 403);

    if (!ec.email) return jsonResponse({ success: true, skipped: "no_email" });
    const email = String(ec.email).trim().toLowerCase();

    const { data: tenant } = await admin.from("tenants").select("name").eq("id", tenantId).single();
    const workspaceName = tenant?.name || "A SimchaSync workspace";
    const appOrigin = getAppOrigin(req);
    const roleLabel = ec.role_instrument || "Colleague";
    const eventLine = [
      event.event_type ? `Event: <strong>${event.event_type}</strong>` : "",
      event.event_date ? `Date: <strong>${event.event_date}</strong>` : "",
      event.venue ? `Venue: <strong>${event.venue}</strong>` : "",
      ec.price ? `Your fee: <strong>$${Number(ec.price).toLocaleString()}</strong>` : "",
    ].filter(Boolean).join("<br>");

    let emailSent = true;
    try {
      await sendBrandedEmail(
        email,
        `You've been added to a booking by ${workspaceName}`,
        emailShell(
          `${workspaceName} added you to a booking`,
          `<p>You've been assigned as <strong>${roleLabel}</strong>.</p><p>${eventLine}</p><p>Open your dashboard to see the full booking details.</p>`,
          "Open Your Bookings",
          `${appOrigin}/app/bookings`,
        ),
      );
    } catch (emailErr) {
      console.error("Colleague event-invite email failed:", emailErr);
      emailSent = false;
    }

    return jsonResponse({ success: true, email_sent: emailSent });
  } catch (err) {
    console.error("colleague-event-invite error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: err instanceof ValidationError ? 400 : 500,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }
});
