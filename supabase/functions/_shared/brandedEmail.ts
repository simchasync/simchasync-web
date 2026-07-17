/// <reference path="./deno-runtime.d.ts" />
import { sendSmtpEmail } from "./smtp.ts";
import { isAllowedOrigin } from "./cors.ts";

/** Escapes user-supplied text before it's interpolated into branded-email HTML —
 * emails are sent from our domain, so unescaped input becomes live HTML/phishing risk. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Standard SimchaSync-branded email layout: gold header, title, body, CTA button. */
export function emailShell(title: string, bodyHtml: string, buttonLabel: string, buttonUrl: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f4;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;border:1px solid #eee5d8;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#c9a227,#e6c34a);height:6px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:36px 40px 0;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#1a1a2e;letter-spacing:0.5px;">🎵 SimchaSync</p>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <h1 style="margin:0;font-size:20px;color:#1a1a2e;text-align:center;">${title}</h1>
        <div style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#555566;">${bodyHtml}</div>
      </td></tr>
      <tr><td style="padding:28px 40px;text-align:center;">
        <a href="${buttonUrl}" style="display:inline-block;background:linear-gradient(135deg,#c9a227,#e6c34a);color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 36px;border-radius:10px;">${buttonLabel}</a>
      </td></tr>
      <tr><td style="padding:0 40px 32px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#999aa6;text-align:center;">If you weren't expecting this email, you can safely ignore it.</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#b5b6c0;">Sent by SimchaSync · Event management for music professionals</p>
  </td></tr>
</table>`;
}

/** Prefer the request Origin — but only when it's on our own allow-list, since
 * this becomes the CTA link in outbound mail; an arbitrary Origin would let a
 * caller point our branded email at their own domain. Falls back to APP_URL,
 * then the production URL. */
export function getAppOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) return origin;
  return Deno.env.get("APP_URL") ?? "https://simchasync-web.vercel.app";
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const siteName = Deno.env.get("SITE_NAME") ?? "SimchaSync";
  const from = Deno.env.get("RESEND_FROM") ?? `${siteName} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

/** True only when Resend has a verified sending domain. Without one,
 * Resend rejects all non-owner recipients — and calling generateLink first
 * would start the per-address email cooldown, guaranteeing the native
 * fallback 429s. */
async function resendCanDeliver(): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return false;
    const body = await res.json();
    return (body?.data ?? []).some((d: { status?: string }) => d.status === "verified");
  } catch {
    return false;
  }
}

/** Branded email via Resend (verified domain) or nodemailer/Gmail SMTP —
 * never the auth mailer, so no cooldowns or hourly caps. */
export async function sendBrandedEmail(to: string, subject: string, html: string): Promise<void> {
  if (await resendCanDeliver()) {
    await sendResendEmail(to, subject, html);
  } else {
    await sendSmtpEmail({ to, subject, html });
  }
}
