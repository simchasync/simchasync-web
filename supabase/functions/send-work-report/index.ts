const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "SimchaSync <onboarding@resend.dev>";
const WORK_REPORT_EMAIL = Deno.env.get("WORK_REPORT_EMAIL") ?? "";
const WORK_REPORT_SECRET = Deno.env.get("WORK_REPORT_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const auth = req.headers.get("authorization");
  if (WORK_REPORT_SECRET && auth !== `Bearer ${WORK_REPORT_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { subject, body, type } = await req.json() as {
      subject: string;
      body: string;
      type: "check-in" | "eod";
    };

    if (!WORK_REPORT_EMAIL) {
      return new Response("WORK_REPORT_EMAIL env var not set", { status: 500 });
    }

    const html = buildEmailHtml(subject, body, type);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: WORK_REPORT_EMAIL,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(err, { status: 500 });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-work-report error:", msg);
    return new Response(msg, { status: 500 });
  }
});

function buildEmailHtml(subject: string, body: string, type: string): string {
  const label = type === "eod" ? "End of Day Report" : "Check-in Report";
  const icon = type === "eod" ? "\u{1F4CB}" : "\u{23F0}";
  return `<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#1a1a2e;font-family:system-ui,sans-serif;">
  <table role="presentation" style="max-width:600px;margin:0 auto;background:#16213e;border-radius:12px;padding:24px;border:1px solid #2a2a4a;width:100%;">
    <tr><td>
      <h2 style="color:#d4af37;margin:0 0 4px;">${icon} ${label}</h2>
      <p style="color:#888;margin:0 0 16px;font-size:14px;">${escapeHtml(subject)}</p>
      <div style="background:#1a1a2e;border-radius:8px;padding:16px;white-space:pre-wrap;font-family:'Courier New',monospace;font-size:14px;line-height:1.6;color:#e0e0e0;">${escapeHtml(body)}</div>
      <hr style="border:none;border-top:1px solid #2a2a4a;margin:20px 0;">
      <p style="color:#666;font-size:12px;text-align:center;">Sent automatically by SimchaSync work-report system</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
