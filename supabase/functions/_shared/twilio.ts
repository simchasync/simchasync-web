/// <reference path="./deno-runtime.d.ts" />

/** Thrown when Twilio secrets are not set, so callers can return a 503 with a
 * clear "SMS not set up" message instead of a generic 500. */
export class SmsNotConfiguredError extends Error {
  constructor() {
    super("SMS is not set up. Add Twilio credentials in Settings.");
    this.name = "SmsNotConfiguredError";
  }
}

const E164 = /^\+[1-9]\d{6,14}$/;

/** Send a plain-text SMS via Twilio. Throws SmsNotConfiguredError if secrets are
 * missing, or a plain Error (with Twilio's message) on invalid number / API failure. */
export async function sendSms(to: string, body: string): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) throw new SmsNotConfiguredError();

  if (!E164.test(to)) {
    throw new Error(`Invalid phone number "${to}". Use international format, e.g. +15551234567.`);
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    let msg = `Twilio request failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.message) msg = err.message;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
}
