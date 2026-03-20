import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoice_id, to_email } = await req.json();
    if (!invoice_id || !to_email) {
      return new Response(JSON.stringify({ error: "invoice_id and to_email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(name, email, phone), events(event_type, event_date)")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payments: any[] = [];
    if (invoice.event_id) {
      const { data } = await supabase
        .from("event_payments")
        .select("*")
        .eq("event_id", invoice.event_id)
        .order("payment_date", { ascending: true });
      payments = data || [];
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, payment_instructions")
      .eq("id", invoice.tenant_id)
      .single();

    const workspaceName = tenant?.name || "SimchaSync";
    const paymentInstructions = tenant?.payment_instructions || "";
    const clientName = invoice.clients?.name || "there";
    const amount = Number(invoice.amount || 0).toFixed(2);

    let eventLine = "";
    if (invoice.events) {
      const d = new Date(invoice.events.event_date);
      const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      eventLine = `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Event</td><td style="padding:8px 0;text-align:right;font-size:14px;font-weight:500;">${invoice.events.event_type} — ${formatted}</td></tr>`;
    }

    let paymentsHtml = "";
    if (payments.length > 0) {
      const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const balanceDue = Number(invoice.amount) - totalPaid;

      let paymentRows = "";
      for (const p of payments) {
        const pDate = new Date(p.payment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const methodLabel = (p.method || "").replace("_", " ");
        paymentRows += `
          <tr style="border-top:1px solid #e8e8e8;">
            <td style="padding:6px 0;color:#475569;font-size:13px;">${pDate} — <span style="text-transform:capitalize;">${methodLabel}</span></td>
            <td style="padding:6px 0;text-align:right;font-size:13px;color:#059669;">-$${Number(p.amount).toFixed(2)}</td>
          </tr>`;
      }

      paymentsHtml = `
        <tr><td colspan="2" style="padding:12px 0 4px;"><p style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;margin:0;">Payments Received</p></td></tr>
        ${paymentRows}
        <tr style="border-top:1px solid #e8e8e8;">
          <td style="padding:8px 0;color:#475569;font-size:14px;">Total Paid</td>
          <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:#059669;">$${totalPaid.toFixed(2)}</td>
        </tr>
        <tr style="border-top:2px solid #d1d5db;background:#f9fafb;">
          <td style="padding:12px 0;font-size:16px;font-weight:700;color:#1a1f2e;">Balance Due</td>
          <td style="padding:12px 0;text-align:right;font-size:20px;font-weight:700;color:#1a1f2e;">$${balanceDue.toFixed(2)}</td>
        </tr>`;
    }

    let paymentInstructionsHtml = "";
    if (paymentInstructions) {
      const escaped = paymentInstructions.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      paymentInstructionsHtml = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#d97706;font-weight:600;margin:0 0 8px;">Payment Instructions</p>
          <p style="font-size:14px;color:#374151;margin:0;line-height:1.6;">${escaped}</p>
        </div>`;
    }

    let paymentButton = "";
    if (invoice.stripe_payment_url) {
      paymentButton = `
        <div style="text-align:center;margin:32px 0;">
          <a href="${invoice.stripe_payment_url}" style="display:inline-block;background:linear-gradient(135deg,hsl(38,80%,55%),hsl(38,70%,48%));color:#1a1f2e;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;font-family:'DM Sans',sans-serif;">
            Pay Online — $${amount}
          </a>
        </div>`;
    }

    const totalRow = payments.length === 0
      ? `<tr style="border-top:2px solid #d1d5db;background:#f9fafb;">
           <td style="padding:12px 0;font-size:16px;font-weight:700;color:#1a1f2e;">Total</td>
           <td style="padding:12px 0;text-align:right;font-size:20px;font-weight:700;color:#1a1f2e;">$${amount}</td>
         </tr>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:28px;color:#1a1f2e;margin:0 0 4px;">Invoice</h1>
      <p style="color:#64748b;font-size:14px;margin:0;">from ${workspaceName}</p>
    </div>
    <div style="background:#fafafa;border:1px solid #e8e8e8;border-radius:12px;padding:28px;margin-bottom:24px;">
      <p style="font-size:16px;color:#1a1f2e;margin:0 0 20px;">Hi ${clientName},</p>
      <p style="font-size:15px;color:#475569;margin:0 0 24px;line-height:1.6;">
        Please find your invoice details below.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e8e8e8;">
          <td style="padding:8px 0;color:#64748b;font-size:14px;">Contract Amount</td>
          <td style="padding:8px 0;text-align:right;font-size:20px;font-weight:700;color:#1a1f2e;">$${amount}</td>
        </tr>
        ${eventLine}
        ${paymentsHtml}
        ${totalRow}
      </table>
    </div>
    ${paymentInstructionsHtml}
    ${paymentButton}
    <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e8e8e8;">
      <p style="color:#94a3b8;font-size:13px;margin:0;">Sent via <strong style="color:#64748b;">SimchaSync</strong></p>
    </div>
  </div>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${workspaceName} via SimchaSync <no-reply@simchasync.com>`,
        to: [to_email],
        subject: `Invoice from ${workspaceName} — $${amount}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", errBody);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("invoices")
      .update({ sent_at: new Date().toISOString(), status: "sent" })
      .eq("id", invoice_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
