import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    const token = url.searchParams.get("token");

    if (!tenantId || !token) {
      return new Response("Missing tenant_id or token", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SimchaSync//Calendar//EN",
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
      lines.push(`UID:${ev.id}@simchasync`);
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
