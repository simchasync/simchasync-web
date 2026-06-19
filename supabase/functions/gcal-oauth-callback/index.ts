/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import {
  deleteGoogleEvent,
  eventToGooglePayload,
  exchangeCodeForTokens,
  upsertGoogleEvent,
  verifyState,
  type EventRow,
} from "../_shared/google-calendar.ts";

// Google redirects the browser here after consent — there is no Supabase JWT,
// so trust comes entirely from the signed `state`. Always 302 back to the app.
const APP_URL = () =>
  Deno.env.get("APP_URL") ?? "https://simchasync-web.vercel.app";

function redirect(status: "connected" | "error", detail?: string) {
  const url = new URL(`${APP_URL()}/app/settings`);
  url.searchParams.set("gcal", status);
  if (detail) url.searchParams.set("gcal_detail", detail);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.email ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) return redirect("error", errorParam);
    if (!code || !state) return redirect("error", "missing_code");

    const stateSecret = Deno.env.get("GCAL_STATE_SECRET")!;
    const payload = await verifyState(stateSecret, state);
    if (!payload) return redirect("error", "bad_state");

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GCAL_REDIRECT_URI")!;

    const tokens = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    );
    if (!tokens.refresh_token) {
      // No refresh token means we can't sync in the background later.
      return redirect("error", "no_refresh_token");
    }

    const googleEmail = await fetchGoogleEmail(tokens.access_token);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("APP_SECRET_API_KEY")!,
      { auth: { persistSession: false } }
    );

    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await admin.from("user_calendar_connections").upsert(
      {
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        provider: "google",
        google_email: googleEmail,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expiry: expiry,
        status: "active",
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tenant_id,provider" }
    );

    // Initial full push for this user (best-effort; never blocks the redirect).
    try {
      await fullSyncForUser(admin, payload.user_id, payload.tenant_id, tokens.access_token);
    } catch (e) {
      console.error("[gcal-oauth-callback] initial sync failed:", e);
    }

    return redirect("connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gcal-oauth-callback]", message);
    return redirect("error", "exception");
  }
});

// Push every current event of the tenant into the freshly connected calendar.
async function fullSyncForUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  accessToken: string
) {
  const { data: events } = await admin
    .from("events")
    .select("id, event_type, event_date, venue, location, notes, hebrew_date, clients(name)")
    .eq("tenant_id", tenantId);

  const { data: existing } = await admin
    .from("event_calendar_sync")
    .select("event_id, google_event_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);

  const map = new Map<string, string>(
    (existing ?? []).map((r: { event_id: string; google_event_id: string }) => [
      r.event_id,
      r.google_event_id,
    ])
  );

  for (const ev of (events ?? []) as unknown as EventRow[]) {
    const googleEventId = map.get(ev.id) ?? null;
    const id = await upsertGoogleEvent(
      accessToken,
      eventToGooglePayload(ev),
      googleEventId
    );
    await admin.from("event_calendar_sync").upsert(
      {
        event_id: ev.id,
        user_id: userId,
        tenant_id: tenantId,
        google_event_id: id,
        last_synced: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" }
    );
    map.delete(ev.id);
  }

  // Remove Google events whose source event no longer exists.
  for (const [eventId, googleEventId] of map) {
    try {
      await deleteGoogleEvent(accessToken, googleEventId);
    } catch (e) {
      console.error("[gcal-oauth-callback] stale delete failed:", e);
    }
    await admin
      .from("event_calendar_sync")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
  }
}
