/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function escapeICS(str: string): string {
  return str.replace(/[\\;,\n]/g, (c) => {
    if (c === "\n") return "\\n";
    return "\\" + c;
  });
}

function getSiteName(): string {
  return Deno.env.get("SITE_NAME") ?? "SimchaSync";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // The token is intentionally read from the query string: this endpoint is
    // an ICS calendar-subscription feed and external calendar clients (Google,
    // Apple, Outlook) can only issue a plain GET on the URL — they cannot send
    // auth headers or a request body. The token is a random UUID, scoped only
    // to read this tenant's calendar, and is revocable: regenerating it in
    // Settings invalidates any previously shared URL.
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    const token = url.searchParams.get("token");

    if (!tenantId || !token) {
      return new Response("Missing tenant_id or token", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("APP_SECRET_API_KEY")!
    );

    const { data: tenant } = await supabase
      .from("tenants")
      .select("calendar_token, name")
      .eq("id", tenantId)
      .single();

    if (!tenant || tenant.calendar_token !== token) {
      return new Response("Invalid token", { status: 403 });
    }

    const { data: events } = await supabase
      .from("events")
      .select("*, clients(name)")
      .eq("tenant_id", tenantId)
      .order("event_date", { ascending: true });

    const siteName = getSiteName();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//${siteName}//Calendar//EN`,
      `X-WR-CALNAME:${escapeICS(tenant.name)}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const ev of events || []) {
      const dtStart = formatICSDate(ev.event_date);
      const endDate = new Date(ev.event_date);
      endDate.setDate(endDate.getDate() + 1);
      const dtEnd = endDate.toISOString().slice(0, 10).replace(/-/g, "");

      const summary = `${ev.event_type}${ev.clients?.name ? ` — ${ev.clients.name}` : ""}`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${ev.id}@${siteName.toLowerCase()}`);
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
      lines.push(`SUMMARY:${escapeICS(summary)}`);
      if (ev.venue) lines.push(`LOCATION:${escapeICS(ev.venue)}`);
      if (ev.notes) lines.push(`DESCRIPTION:${escapeICS(ev.notes)}`);
      if (ev.hebrew_date) lines.push(`X-HEBREW-DATE:${escapeICS(ev.hebrew_date)}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tenant.name}.ics"`,
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("calendar-export error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
