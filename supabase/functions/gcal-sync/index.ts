/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  deleteGoogleEvent,
  eventToGooglePayload,
  refreshAccessToken,
  upsertGoogleEvent,
  type EventRow,
} from "../_shared/google-calendar.ts";

type Admin = ReturnType<typeof createClient>;

interface Connection {
  id: string;
  user_id: string;
  tenant_id: string;
  refresh_token: string | null;
  access_token: string | null;
  token_expiry: string | null;
  status: string;
  sync_enabled: boolean;
}

// Return a valid access token for the connection, refreshing + persisting if
// expired. Marks the connection needs_reauth and returns null on failure.
async function validAccessToken(
  admin: Admin,
  conn: Connection,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const stillValid =
    conn.access_token &&
    conn.token_expiry &&
    new Date(conn.token_expiry).getTime() - Date.now() > 60_000;
  if (stillValid) return conn.access_token;

  if (!conn.refresh_token) return null;
  try {
    const { accessToken, expiresIn } = await refreshAccessToken(
      conn.refresh_token,
      clientId,
      clientSecret
    );
    await admin
      .from("user_calendar_connections")
      .update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + expiresIn * 1000).toISOString(),
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);
    return accessToken;
  } catch (e) {
    console.error("[gcal-sync] refresh failed for", conn.id, e);
    await admin
      .from("user_calendar_connections")
      .update({ status: "needs_reauth", updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    return null;
  }
}

async function pushEvent(
  admin: Admin,
  conn: Connection,
  accessToken: string,
  ev: EventRow
) {
  const { data: existing } = await admin
    .from("event_calendar_sync")
    .select("google_event_id")
    .eq("event_id", ev.id)
    .eq("user_id", conn.user_id)
    .maybeSingle();

  const googleEventId = await upsertGoogleEvent(
    accessToken,
    eventToGooglePayload(ev),
    existing?.google_event_id ?? null
  );

  await admin.from("event_calendar_sync").upsert(
    {
      event_id: ev.id,
      user_id: conn.user_id,
      tenant_id: conn.tenant_id,
      google_event_id: googleEventId,
      last_synced: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" }
  );
}

async function deleteEvent(
  admin: Admin,
  conn: Connection,
  accessToken: string,
  eventId: string
) {
  const { data: existing } = await admin
    .from("event_calendar_sync")
    .select("google_event_id")
    .eq("event_id", eventId)
    .eq("user_id", conn.user_id)
    .maybeSingle();
  if (!existing?.google_event_id) return;

  await deleteGoogleEvent(accessToken, existing.google_event_id);
  await admin
    .from("event_calendar_sync")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", conn.user_id);
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("APP_SECRET_API_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const user = userData?.user;
    if (userError || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "full";
    const eventId: string | undefined = body.eventId;
    const tenantId: string | undefined = body.tenantId;
    if (!tenantId) return json({ error: "missing tenantId" }, 400);

    // Caller must belong to the tenant they're syncing.
    const { data: membership } = await admin
      .from("tenant_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    // "full" syncs only the caller's own calendar; per-event changes fan out to
    // every connected member of the tenant.
    const connQuery = admin
      .from("user_calendar_connections")
      .select(
        "id, user_id, tenant_id, refresh_token, access_token, token_expiry, status, sync_enabled"
      )
      .eq("tenant_id", tenantId)
      .eq("provider", "google")
      .eq("sync_enabled", true);
    if (action === "full") connQuery.eq("user_id", user.id);

    const { data: connections } = await connQuery;
    if (!connections || connections.length === 0) {
      return json({ ok: true, synced: 0 });
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

    let synced = 0;
    for (const conn of connections as unknown as Connection[]) {
      const accessToken = await validAccessToken(admin, conn, clientId, clientSecret);
      if (!accessToken) continue;

      try {
        if (action === "delete" && eventId) {
          await deleteEvent(admin, conn, accessToken, eventId);
        } else if (action === "upsert" && eventId) {
          const { data: ev } = await admin
            .from("events")
            .select(
              "id, event_type, event_date, venue, location, notes, hebrew_date, clients(name)"
            )
            .eq("id", eventId)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          if (ev) await pushEvent(admin, conn, accessToken, ev as unknown as EventRow);
        } else {
          // full
          const { data: events } = await admin
            .from("events")
            .select(
              "id, event_type, event_date, venue, location, notes, hebrew_date, clients(name)"
            )
            .eq("tenant_id", tenantId);
          for (const ev of (events ?? []) as unknown as EventRow[]) {
            await pushEvent(admin, conn, accessToken, ev);
          }
        }
        synced++;
      } catch (e) {
        console.error("[gcal-sync] push failed for", conn.id, e);
      }
    }

    return json({ ok: true, synced });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gcal-sync]", message);
    return json({ error: message }, 500);
  }
});
