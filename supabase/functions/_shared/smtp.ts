/// <reference path="./deno-runtime.d.ts" />
// @ts-expect-error - npm module via Deno node-compat
import nodemailer from "npm:nodemailer@6.10.1";

/** Sends an email over SMTP (Gmail by default) via nodemailer.
 * Secrets: SMTP_USER + SMTP_PASS (Gmail app password); optional SMTP_HOST/SMTP_PORT.
 * Used as the branded-email channel while no Resend domain is verified —
 * unlike the Supabase auth mailer, this has no per-address cooldown and no
 * project hourly cap (Gmail allows ~500 emails/day). */
export async function sendSmtpEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) throw new Error("SMTP_USER / SMTP_PASS secrets are not set");

  const siteName = Deno.env.get("SITE_NAME") ?? "SimchaSync";
  const transporter = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
    port: Number(Deno.env.get("SMTP_PORT") ?? 465),
    secure: true,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `${siteName} <${user}>`,
    to,
    subject,
    html,
  });
}
