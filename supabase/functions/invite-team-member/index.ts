/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
// @ts-expect-error - Deno runtime module resolution
import * as React from "npm:react@18.3.1";
// @ts-expect-error - External module
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { ValidationError, parseBody } from "../_shared/validation.ts";
import { sendSmtpEmail } from "../_shared/smtp.ts";
import { InviteEmail } from "../_shared/email-templates/invite.tsx";
import { buildCorsHeaders } from "../_shared/cors.ts";

const inviteSchema = z.object({
  email: z.string().email("email must be a valid email address"),
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
  role: z.enum(["owner", "booking_manager", "social_media_manager", "member"]).optional(),
});

function getFallbackAppOrigin(): string {
  return Deno.env.get("APP_URL") ?? "https://simchasync-web.vercel.app";
}

type InviteRole = "owner" | "booking_manager" | "social_media_manager" | "member";

const ROLE_LABELS: Record<InviteRole, string> = {
  owner: "an Owner",
  booking_manager: "a Booking Manager",
  social_media_manager: "a Social Media Manager",
  member: "a Member",
};

function jsonResponse(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function friendlyEmailError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("verify a domain")) {
    return "The email service is in test mode (no verified sending domain), so the invite email could only be delivered to the email service account owner.";
  }
  if (msg.includes("rate_limit") || msg.includes("rate limit")) {
    return "Email rate limit reached — wait a few minutes and re-invite to resend the email.";
  }
  return msg;
}

/** True only when Resend can actually deliver to arbitrary recipients
 * (a verified sending domain exists). Without one, Resend rejects all
 * non-owner addresses — and calling generateLink first would start the
 * per-address email cooldown, guaranteeing the native fallback 429s. */
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

function resolveAppOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return getFallbackAppOrigin();
    }
  }

  return getFallbackAppOrigin();
}

async function sendInviteEmail({
  recipientEmail,
  recipientName,
  tenantName,
  inviterName,
  requestedRole,
  actionLink,
  appOrigin,
  existingUser,
}: {
  recipientEmail: string;
  recipientName?: string;
  tenantName: string;
  inviterName?: string;
  requestedRole: InviteRole;
  actionLink: string;
  appOrigin: string;
  existingUser: boolean;
}) {
  const siteName = Deno.env.get("SITE_NAME") ?? "SimchaSync";

  const props = {
    siteName,
    siteUrl: appOrigin,
    confirmationUrl: actionLink,
    recipientName,
    tenantName,
    roleLabel: ROLE_LABELS[requestedRole],
    inviterName,
    existingUser,
  };
  const html = await renderAsync(React.createElement(InviteEmail, props));
  const text = await renderAsync(React.createElement(InviteEmail, props), { plainText: true });
  const subject = `You've been invited to join ${tenantName} on ${siteName}`;

  // Branded email via Resend when a verified domain exists; otherwise the
  // same branded HTML over SMTP (nodemailer + Gmail) — no auth-mailer
  // cooldowns or hourly caps either way.
  if (!(await resendCanDeliver())) {
    await sendSmtpEmail({ to: recipientEmail, subject, html });
    return;
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) throw new Error("RESEND_API_KEY is not set");
  const from = Deno.env.get("RESEND_FROM") ?? `${siteName} <onboarding@resend.dev>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipientEmail],
      subject: `You've been invited to join ${tenantName} on ${siteName}`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend error ${res.status}: ${errBody}`);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: Record<string, unknown>, status = 200) => jsonResponse(body, status, corsHeaders);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("APP_SECRET_API_KEY")!;
    const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY"))!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const caller = { id: claimsData.claims.sub as string };

    const { email, tenant_id, role } = parseBody(inviteSchema, await req.json());
    const requestedRole: InviteRole = role ?? "member";

    const { data: callerMembership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", caller.id)
      .single();

    if (membershipError || !callerMembership) {
      return json({ error: "Unauthorized" }, 403);
    }

    const canInviteColleagues = callerMembership.role === "owner" || callerMembership.role === "booking_manager";
    const canInviteTeammates = callerMembership.role === "owner";

    if (requestedRole === "member" ? !canInviteColleagues : !canInviteTeammates) {
      return json(
        { error: requestedRole === "member" ? "Only owners and booking managers can invite colleagues" : "Only owners can invite teammates" },
        403,
      );
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenantData) {
      return json({ error: "Workspace not found" }, 404);
    }

    const tenantName = tenantData.name || "your workspace";
    const appOrigin = resolveAppOrigin(req);

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", caller.id)
      .maybeSingle();
    const inviterName = inviterProfile?.full_name || undefined;

    const { data: existingUsersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const existingUser = existingUsersData?.users?.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (existingUser && existingUser.id === caller.id) {
      return json({ error: "You cannot invite yourself — you are already a member of this workspace." }, 400);
    }

    // Don't fire a duplicate email if one just went out for this membership
    const EMAIL_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

    if (existingUser) {
      const { data: existingMembership } = await supabase
        .from("tenant_members")
        .select("id, role, invitation_status, invited_at")
        .eq("tenant_id", tenant_id)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (
        existingMembership?.invitation_status === "invited" &&
        existingMembership.role === requestedRole &&
        existingMembership.invited_at &&
        Date.now() - new Date(existingMembership.invited_at).getTime() < EMAIL_RESEND_COOLDOWN_MS
      ) {
        return json({
          success: true,
          invited: true,
          added: false,
          already_member: false,
          already_sent: true,
          email_sent: false,
          user_id: existingUser.id,
        });
      }

      if (!existingMembership) {
        const { error: insertErr } = await supabase.from("tenant_members").insert({
          tenant_id,
          user_id: existingUser.id,
          role: requestedRole,
          invitation_status: "invited",
          invitation_email: email,
          invited_by: caller.id,
          invited_at: new Date().toISOString(),
        } as never);
        if (insertErr) throw insertErr;
      } else if (existingMembership.role !== requestedRole || existingMembership.invitation_status !== "invited") {
        const { error: updateErr } = await supabase
          .from("tenant_members")
          .update({
            role: requestedRole,
            invitation_status: existingMembership.invitation_status === "accepted" ? "accepted" : "invited",
            invitation_email: email,
            invited_by: caller.id,
            invited_at: new Date().toISOString(),
          } as never)
          .eq("id", existingMembership.id);
        if (updateErr) throw updateErr;
      }

      // generateLink sends nothing itself; the branded email goes out via
      // Resend (verified domain) or nodemailer/Gmail SMTP — never the
      // auth mailer, so no cooldown/rate-limit collisions.
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${appOrigin}/app/bookings?tenant=${tenant_id}` },
      });
      if (linkError) throw linkError;

      let emailSent = true;
      let emailError: string | null = null;
      try {
        await sendInviteEmail({
          recipientEmail: email,
          recipientName: (existingUser.user_metadata?.full_name as string) || undefined,
          tenantName,
          inviterName,
          requestedRole,
          actionLink: linkData.properties.action_link,
          appOrigin,
          existingUser: true,
        });
      } catch (emailErr) {
        console.error("Invite email failed:", emailErr);
        emailSent = false;
        emailError = friendlyEmailError(emailErr);
      }

      // Stamp the send time so rapid re-invites are throttled
      if (emailSent) {
        await supabase
          .from("tenant_members")
          .update({ invited_at: new Date().toISOString() } as never)
          .eq("tenant_id", tenant_id)
          .eq("user_id", existingUser.id);
      }

      return json({
        success: true,
        invited: !existingMembership || existingMembership.invitation_status !== "accepted",
        added: !existingMembership,
        already_member: !!existingMembership && existingMembership.invitation_status === "accepted",
        email_sent: emailSent,
        email_error: emailError,
        user_id: existingUser.id,
      });
    }

    // New user: create the account + link silently, then send the branded email
    const { data: inviteLinkData, error: inviteErr } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${appOrigin}/reset-password?tenant=${tenant_id}`,
        data: { invited_to_tenant: tenant_id, invited_to_tenant_name: tenantName, role: requestedRole },
      },
    });
    if (inviteErr) throw inviteErr;
    const invitedUserId = inviteLinkData.user.id;

    const { error: membershipInsertError } = await supabase.from("tenant_members").insert({
      tenant_id,
      user_id: invitedUserId,
      role: requestedRole,
      invitation_status: "invited",
      invitation_email: email,
      invited_by: caller.id,
      invited_at: new Date().toISOString(),
    } as never);
    if (membershipInsertError) throw membershipInsertError;

    let emailSent = true;
    let emailError: string | null = null;
    try {
      await sendInviteEmail({
        recipientEmail: email,
        tenantName,
        inviterName,
        requestedRole,
        actionLink: inviteLinkData.properties.action_link,
        appOrigin,
        existingUser: false,
      });
    } catch (emailErr) {
      console.error("Invite email failed:", emailErr);
      emailSent = false;
      emailError = friendlyEmailError(emailErr);
    }

    return json({
      success: true,
      invited: true,
      added: true,
      already_member: false,
      email_sent: emailSent,
      email_error: emailError,
      user_id: invitedUserId,
    });
  } catch (err) {
    console.error("invite-team-member error:", err);
    return json({
      error: err instanceof Error ? err.message : "Unknown error",
    }, err instanceof ValidationError ? 400 : 500);
  }
});
