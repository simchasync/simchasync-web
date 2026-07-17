/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { sendSms, SmsNotConfiguredError } from "../_shared/twilio.ts";

const MAX_BODY = 640;
// ponytail: flat per-tenant cap, revisit with a configurable/tiered limit if legitimate use hits it
const DAILY_SMS_LIMIT = 50;

const digitsOnly = (phone: string) => phone.replace(/\D/g, "");

/** Tolerates missing/extra country code and free-text formatting differences. */
function sameNumber(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  return da === db || da.endsWith(db) || db.endsWith(da);
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY"))!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const { tenant_id, to, body } = await req.json();
    if (!tenant_id || !to || !body) {
      return json({ error: "tenant_id, to, and body are required" }, 400);
    }
    const text = String(body).slice(0, MAX_BODY);

    const supabase = createClient(supabaseUrl, Deno.env.get("APP_SECRET_API_KEY")!);

    const { data: memberCheck } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .eq("invitation_status", "accepted")
      .in("role", ["owner", "booking_manager"])
      .single();

    if (!memberCheck) {
      return json({ error: "Forbidden: not authorized for this workspace" }, 403);
    }

    const [{ data: clientMatches }, { data: requestMatches }] = await Promise.all([
      supabase.from("clients").select("phone").eq("tenant_id", tenant_id).not("phone", "is", null),
      supabase.from("booking_requests").select("phone").eq("tenant_id", tenant_id).not("phone", "is", null),
    ]);
    const knownNumbers = [...(clientMatches ?? []), ...(requestMatches ?? [])].map((r) => r.phone as string);
    if (!knownNumbers.some((known) => sameNumber(known, String(to)))) {
      return json({ error: "Forbidden: recipient is not a known contact for this workspace" }, 403);
    }

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("sms_log")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .gte("sent_at", todayStart.toISOString());
    if ((count ?? 0) >= DAILY_SMS_LIMIT) {
      return json({ error: `Daily SMS limit (${DAILY_SMS_LIMIT}) reached for this workspace. Try again tomorrow.` }, 429);
    }

    await sendSms(String(to), text);
    await supabase.from("sms_log").insert({ tenant_id, to_number: to });
    return json({ success: true });
  } catch (err) {
    if (err instanceof SmsNotConfiguredError) return json({ error: err.message }, 503);
    console.error("send-sms error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
