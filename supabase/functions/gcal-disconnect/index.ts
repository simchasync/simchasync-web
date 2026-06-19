/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { revokeToken } from "../_shared/google-calendar.ts";

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

    const { data: conn } = await admin
      .from("user_calendar_connections")
      .select("id, refresh_token, access_token")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("provider", "google")
      .maybeSingle();

    if (conn) {
      const token = conn.refresh_token ?? conn.access_token;
      if (token) await revokeToken(token);

      await admin
        .from("event_calendar_sync")
        .delete()
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId);

      await admin
        .from("user_calendar_connections")
        .delete()
        .eq("id", conn.id);
    }

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gcal-disconnect]", message);
    return json({ error: message }, 500);
  }
});
