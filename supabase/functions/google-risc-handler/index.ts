/// <reference path="../_shared/deno-runtime.d.ts" />

// Google Cross-Account Protection (RISC) webhook.
// Google calls this when a user's Google account has a security event
// (compromised, signed out everywhere, etc.) so we can revoke their session.
// verify_jwt = false — Google sends its own signed JWT, not a Supabase JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

async function verifyGoogleToken(token: string): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(
    atob(headerB64.replace(/-/g, "+").replace(/_/g, "/"))
  );

  const jwksRes = await fetch(GOOGLE_JWKS_URL);
  const { keys } = await jwksRes.json() as { keys: JsonWebKey[] };
  const jwk = (keys as Array<JsonWebKey & { kid?: string }>).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("No matching Google signing key");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = Uint8Array.from(
    atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    sig,
    new TextEncoder().encode(signingInput)
  );
  if (!valid) throw new Error("Invalid token signature");

  return JSON.parse(
    atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
  ) as Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Google sends POST; OPTIONS not needed but handle gracefully
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const token = await req.text();
    const payload = await verifyGoogleToken(token);

    const events = (payload.events ?? {}) as Record<string, unknown>;
    const googleSub = payload.sub as string | undefined;
    if (!googleSub) return new Response("", { status: 202 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("APP_SECRET_API_KEY")!
    );

    // Find the Supabase user whose Google identity matches
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const user = users.find(
      (u) =>
        u.app_metadata?.provider === "google" &&
        (u.user_metadata?.sub === googleSub || u.user_metadata?.provider_id === googleSub)
    );

    if (!user) {
      // Unknown user — acknowledge so Google stops retrying
      return new Response("", { status: 202 });
    }

    const shouldRevoke = Object.keys(events).some((type) =>
      type.includes("sessions-revoked") ||
      type.includes("account-disabled") ||
      type.includes("account-purged") ||
      type.includes("credential-change-required")
    );

    if (shouldRevoke) {
      await supabase.auth.admin.signOut(user.id, "global");
    }

    return new Response("", { status: 202 });
  } catch (err) {
    console.error("RISC handler error:", err);
    // Always 202 — returning 4xx causes Google to retry indefinitely
    return new Response("", { status: 202 });
  }
});
