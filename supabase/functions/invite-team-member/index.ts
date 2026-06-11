/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
// @ts-expect-error - Deno runtime module resolution
import * as React from "npm:react@18.3.1";
// @ts-expect-error - External module
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { ValidationError, parseBody } from "../_shared/validation.ts";
import { InviteEmail } from "../_shared/email-templates/invite.tsx";

const inviteSchema = z.object({
  email: z.string().email("email must be a valid email address"),
  tenant_id: z.string().uuid("tenant_id must be a valid UUID"),
  role: z.enum(["owner", "booking_manager", "social_media_manager", "member"]).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) throw new Error("RESEND_API_KEY is not set");

  const siteName = Deno.env.get("SITE_NAME") ?? "SimchaSync";
  const from = Deno.env.get("RESEND_FROM") ?? `${siteName} <onboarding@resend.dev>`;

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("APP_SECRET_API_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
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
      return jsonResponse({ error: "Unauthorized" }, 403);
    }

    const canInviteColleagues = callerMembership.role === "owner" || callerMembership.role === "booking_manager";
    const canInviteTeammates = callerMembership.role === "owner";

    if (requestedRole === "member" ? !canInviteColleagues : !canInviteTeammates) {
      return jsonResponse(
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
      return jsonResponse({ error: "Workspace not found" }, 404);
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

    if (existingUser) {
      const { data: existingMembership } = await supabase
        .from("tenant_members")
        .select("id, role, invitation_status")
        .eq("tenant_id", tenant_id)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (!existingMembership) {
        const { error: insertErr } = await supabase.from("tenant_members").insert({
          tenant_id,
          user_id: existingUser.id,
          role: requestedRole,
          invitation_status: "invited",
          invitation_email: email,
          invited_by: caller.id,
        });
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

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${appOrigin}/app/bookings?tenant=${tenant_id}` },
      });
      if (linkError) throw linkError;

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

      return jsonResponse({
        success: true,
        invited: !existingMembership || existingMembership.invitation_status !== "accepted",
        added: !existingMembership,
        already_member: !!existingMembership && existingMembership.invitation_status === "accepted",
        email_sent: true,
        user_id: existingUser.id,
      });
    }

    const { data: inviteLinkData, error: inviteErr } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${appOrigin}/reset-password?tenant=${tenant_id}`,
        data: { invited_to_tenant: tenant_id, invited_to_tenant_name: tenantName, role: requestedRole },
      },
    });
    if (inviteErr) throw inviteErr;

    const invitedUser = inviteLinkData.user;

    const { error: membershipInsertError } = await supabase.from("tenant_members").insert({
      tenant_id,
      user_id: invitedUser.id,
      role: requestedRole,
      invitation_status: "invited",
      invitation_email: email,
      invited_by: caller.id,
    });
    if (membershipInsertError) throw membershipInsertError;

    await sendInviteEmail({
      recipientEmail: email,
      tenantName,
      inviterName,
      requestedRole,
      actionLink: inviteLinkData.properties.action_link,
      appOrigin,
      existingUser: false,
    });

    return jsonResponse({
      success: true,
      invited: true,
      added: true,
      already_member: false,
      email_sent: true,
      user_id: invitedUser.id,
    });
  } catch (err) {
    console.error("invite-team-member error:", err);
    return jsonResponse({
      error: err instanceof Error ? err.message : "Unknown error",
    }, err instanceof ValidationError ? 400 : 500);
  }
});
