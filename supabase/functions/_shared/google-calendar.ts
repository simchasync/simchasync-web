/// <reference path="./deno-runtime.d.ts" />

// Shared helpers for the Google Calendar one-way push integration.
// No Supabase import here — pure Google API + state-signing utilities.

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CAL_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export interface EventRow {
  id: string;
  event_type: string;
  event_date: string;
  venue: string | null;
  location: string | null;
  notes: string | null;
  hebrew_date: string | null;
  clients?: { name: string | null } | null;
}

/** Map a SimchaSync event row to a Google Calendar all-day event payload. */
export function eventToGooglePayload(ev: EventRow): Record<string, unknown> {
  const end = new Date(ev.event_date + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const endDate = end.toISOString().slice(0, 10);

  const summary = `${ev.event_type}${
    ev.clients?.name ? ` — ${ev.clients.name}` : ""
  }`;

  const descParts: string[] = [];
  if (ev.notes) descParts.push(ev.notes);
  if (ev.hebrew_date) descParts.push(`Hebrew date: ${ev.hebrew_date}`);

  return {
    summary,
    location: ev.venue ?? ev.location ?? undefined,
    description: descParts.length ? descParts.join("\n\n") : undefined,
    start: { date: ev.event_date },
    end: { date: endDate },
  };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/** Exchange an authorization code for tokens (initial connect). */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

/** Refresh an access token from a stored refresh token. */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json: TokenResponse = await res.json();
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** Create or update a Google event. Returns the Google event id. */
export async function upsertGoogleEvent(
  accessToken: string,
  payload: Record<string, unknown>,
  googleEventId: string | null
): Promise<string> {
  const url = googleEventId
    ? `${GOOGLE_CAL_BASE}/${encodeURIComponent(googleEventId)}`
    : GOOGLE_CAL_BASE;
  const res = await fetch(url, {
    method: googleEventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  // A stale mapping (event deleted in Google) → recreate it.
  if (res.status === 404 && googleEventId) {
    return await upsertGoogleEvent(accessToken, payload, null);
  }
  if (!res.ok) {
    throw new Error(
      `Google upsert failed: ${res.status} ${await res.text()}`
    );
  }
  const json = await res.json();
  return json.id as string;
}

/** Delete a Google event. Swallows 404/410 (already gone). */
export async function deleteGoogleEvent(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CAL_BASE}/${encodeURIComponent(googleEventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(
      `Google delete failed: ${res.status} ${await res.text()}`
    );
  }
}

/** Best-effort revoke of a token at Google (used on disconnect). */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch {
    // Revocation is best-effort; ignore network errors.
  }
}

// ---- OAuth `state` signing (HMAC-SHA256, no external dep) ----

interface StatePayload {
  user_id: string;
  tenant_id: string;
  exp: number;
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return new Uint8Array(sig);
}

/** Sign a `state` token valid for `ttlSeconds` (default 10 min). */
export async function signState(
  secret: string,
  payload: Omit<StatePayload, "exp">,
  ttlSeconds = 600
): Promise<string> {
  const full: StatePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(full)));
  const sig = b64url(await hmac(secret, body));
  return `${body}.${sig}`;
}

/** Verify a `state` token. Returns the payload or null if invalid/expired. */
export async function verifyState(
  secret: string,
  state: string
): Promise<StatePayload | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = b64url(await hmac(secret, body));
  // Constant-time-ish compare.
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body))
    ) as StatePayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
