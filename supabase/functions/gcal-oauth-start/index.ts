/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { GOOGLE_SCOPE, signState } from "../_shared/google-calendar.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

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

    const { tenantId } = await req.json().catch(() => ({ tenantId: null }));
    if (!tenantId || typeof tenantId !== "string") {
      return json({ error: "missing tenantId" }, 400);
    }

    // Confirm the caller actually belongs to this tenant.
    const { data: membership } = await admin
      .from("tenant_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const redirectUri = Deno.env.get("GCAL_REDIRECT_URI")!;
    const stateSecret = Deno.env.get("GCAL_STATE_SECRET")!;

    const state = await signState(stateSecret, {
      user_id: user.id,
      tenant_id: tenantId,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });

    return json({ url: `${GOOGLE_AUTH_URL}?${params.toString()}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gcal-oauth-start]", message);
    return json({ error: message }, 500);
  }
});
