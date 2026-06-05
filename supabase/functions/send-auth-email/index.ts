/// <reference path="../_shared/deno-runtime.d.ts" />
/**
 * Supabase "Send email" auth hook (Standard Webhooks + Resend).
 *
 * Secrets: RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET, SUPABASE_URL
 * Optional: RESEND_FROM, APP_URL (default simchasync-web.vercel.app), SITE_NAME (default SimchaSync)
 */
// @ts-expect-error - Deno runtime module resolution
import * as React from "npm:react@18.3.1";
// @ts-expect-error - External module
import { renderAsync } from "npm:@react-email/components@0.0.22";
// @ts-expect-error - External module
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

import { SignupEmail } from "../_shared/email-templates/signup.tsx";
import { InviteEmail } from "../_shared/email-templates/invite.tsx";
import { MagicLinkEmail } from "../_shared/email-templates/magic-link.tsx";
import { RecoveryEmail } from "../_shared/email-templates/recovery.tsx";
import { EmailChangeEmail } from "../_shared/email-templates/email-change.tsx";
import { ReauthenticationEmail } from "../_shared/email-templates/reauthentication.tsx";

function getSiteName(): string {
  return Deno.env.get("SITE_NAME") ?? "SimchaSync";
}

function getAppUrl(): string {
  return Deno.env.get("APP_URL") ?? "https://simchasync-web.vercel.app";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp",
};

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
  old_email?: string;
  old_phone?: string;
  provider?: string;
  factor_type?: string;
};

type UserPayload = {
  id?: string;
  email?: string;
  new_email?: string;
  user_metadata?: Record<string, string>;
  [k: string]: unknown;
};

function getHookSecret(): string {
  const raw = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!raw) throw new Error("SEND_EMAIL_HOOK_SECRET is not set");
  return raw.replace("v1,whsec_", "");
}

function buildVerifyUrl(supabaseUrl: string, data: EmailData): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const u = new URL(`${base}/auth/v1/verify`);
  u.searchParams.set("token", data.token_hash);
  u.searchParams.set("type", data.email_action_type);
  u.searchParams.set("redirect_to", getAppUrl());
  return u.toString();
}

const SUBJECTS: Record<string, string> = {
  signup: "Confirm your email",
  invite: "You've been invited",
  magiclink: "Your login link",
  email: "Your login link",
  recovery: "Reset your password",
  email_change: "Confirm your email change",
  reauthentication: "Your verification code",
};

async function sendResend(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const siteName = getSiteName();
  const fromDomain = Deno.env.get("RESEND_FROM") ?? `${siteName} <onboarding@resend.dev>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromDomain, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend error ${res.status}: ${errBody}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400, headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: { message: "SUPABASE_URL missing" } }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(getHookSecret());

  let user: UserPayload;
  let emailData: EmailData;
  try {
    const verified = wh.verify(payload, headers) as { user: UserPayload; email_data: EmailData };
    user = verified.user;
    emailData = verified.email_data;
  } catch (e) {
    const message = e instanceof Error ? e.message : "webhook verify failed";
    console.error("send-auth-email: verify failed", message);
    return new Response(JSON.stringify({ error: { message } }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const email = user.email;
  if (!email) {
    return new Response(JSON.stringify({ error: { message: "user.email missing" } }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const action = emailData.email_action_type;
  const oldEmail = (emailData as { old_email?: string }).old_email;
  const subject = SUBJECTS[action] ?? "Notification from SimchaSync";
  const siteUrl = emailData.site_url || emailData.redirect_to || supabaseUrl;
  const recipientName = (user.user_metadata?.full_name as string) || email.split("@")[0] || "there";
  const confirmation = buildVerifyUrl(supabaseUrl, emailData);
  const siteName = getSiteName();

  try {
    if (action === "signup") {
      let siteUrlDisplay = siteUrl;
      try {
        siteUrlDisplay = new URL(emailData.redirect_to).origin;
      } catch {
        /* keep siteUrl */
      }
      const html = await renderAsync(
        React.createElement(SignupEmail, {
          siteName,
          siteUrl: siteUrlDisplay,
          recipient: email,
          confirmationUrl: confirmation,
        }),
      );
      const text = await renderAsync(
        React.createElement(SignupEmail, {
          siteName,
          siteUrl: siteUrlDisplay,
          recipient: email,
          confirmationUrl: confirmation,
        }),
        { plainText: true },
      );
      await sendResend(email, subject, html, text);
    } else if (action === "recovery") {
      const html = await renderAsync(
        React.createElement(RecoveryEmail, { siteName, confirmationUrl: confirmation }),
      );
      const text = await renderAsync(
        React.createElement(RecoveryEmail, { siteName, confirmationUrl: confirmation }),
        { plainText: true },
      );
      await sendResend(email, subject, html, text);
    } else if (action === "magiclink" || action === "email") {
      const html = await renderAsync(
        React.createElement(MagicLinkEmail, { siteName, confirmationUrl: confirmation }),
      );
      const text = await renderAsync(
        React.createElement(MagicLinkEmail, { siteName, confirmationUrl: confirmation }),
        { plainText: true },
      );
      await sendResend(email, subject, html, text);
    } else if (action === "invite") {
      const html = await renderAsync(
        React.createElement(InviteEmail, {
          siteName,
          siteUrl,
          confirmationUrl: confirmation,
        }),
      );
      const text = await renderAsync(
        React.createElement(InviteEmail, {
          siteName,
          siteUrl,
          confirmationUrl: confirmation,
        }),
        { plainText: true },
      );
      await sendResend(email, subject, html, text);
    } else if (action === "reauthentication") {
      const html = await renderAsync(
        React.createElement(ReauthenticationEmail, { token: emailData.token }),
      );
      const text = await renderAsync(
        React.createElement(ReauthenticationEmail, { token: emailData.token }),
        { plainText: true },
      );
      await sendResend(email, subject, html, text);
    } else if (action === "email_change") {
      const conf = buildVerifyUrl(supabaseUrl, emailData);
      const displayOld = oldEmail || email;
      const displayNew = user.new_email || email;
      const html = await renderAsync(
        React.createElement(EmailChangeEmail, {
          siteName,
          email: displayOld,
          newEmail: displayNew,
          confirmationUrl: conf,
        }),
      );
      const text = await renderAsync(
        React.createElement(EmailChangeEmail, {
          siteName,
          email: displayOld,
          newEmail: displayNew,
          confirmationUrl: conf,
        }),
        { plainText: true },
      );
      await sendResend(email, subject, html, text);
    } else {
      const html = `<p>Hi ${recipientName},</p><p><a href="${confirmation}">Continue</a></p><p>Your code: <strong>${
        emailData.token
      }</strong></p>`;
      const text = `Hi ${recipientName},\n\nLink: ${confirmation}\n\nCode: ${emailData.token}`;
      await sendResend(email, subject, html, text);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("send-auth-email: send failed", message);
    return new Response(JSON.stringify({ error: { message } }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
