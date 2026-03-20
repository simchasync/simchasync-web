import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_APP_ORIGIN = "https://id-preview--d0c4f6a4-4f55-4082-83e5-75fea084594c.lovable.app";

type InviteRole = "owner" | "booking_manager" | "social_media_manager" | "member";

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
      return FALLBACK_APP_ORIGIN;
    }
  }

  return FALLBACK_APP_ORIGIN;
}

async function sendExistingUserLoginEmail({
  supabaseUrl,
  anonKey,
  recipientEmail,
  tenantId,
  tenantName,
  appOrigin,
  requestedRole,
}: {
  supabaseUrl: string;
  anonKey: string;
  recipientEmail: string;
  tenantId: string;
  tenantName: string;
  appOrigin: string;
  requestedRole: InviteRole;
}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: recipientEmail,
      create_user: false,
      data: {
        invited_to_tenant: tenantId,
        invited_to_tenant_name: tenantName,
        role: requestedRole,
      },
      email_redirect_to: `${appOrigin}/app/bookings?tenant=${tenantId}`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to send workspace login email: ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { email, tenant_id, role } = await req.json() as {
      email?: string;
      tenant_id?: string;
      role?: InviteRole;
    };

    const requestedRole: InviteRole = role ?? "member";

    if (!email || !tenant_id) {
      return jsonResponse({ error: "email and tenant_id are required" }, 400);
    }

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

      let emailSent = false;
      try {
        await sendExistingUserLoginEmail({
          supabaseUrl,
          anonKey,
          recipientEmail: email,
          tenantId: tenant_id,
          tenantName,
          appOrigin,
          requestedRole,
        });
        emailSent = true;
      } catch (emailErr) {
        const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
        if (msg.includes("over_email_send_rate_limit")) {
          console.warn("Email rate limited, membership created but email skipped:", msg);
        } else {
          throw emailErr;
        }
      }

      return jsonResponse({
        success: true,
        invited: !existingMembership || existingMembership.invitation_status !== "accepted",
        added: !existingMembership,
        already_member: !!existingMembership && existingMembership.invitation_status === "accepted",
        email_sent: emailSent,
        user_id: existingUser.id,
      });
    }

    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appOrigin}/reset-password?tenant=${tenant_id}`,
      data: { invited_to_tenant: tenant_id, invited_to_tenant_name: tenantName, role: requestedRole },
    });
    if (inviteErr) throw inviteErr;

    const { data: newUsersData, error: refreshUsersError } = await supabase.auth.admin.listUsers();
    if (refreshUsersError) throw refreshUsersError;

    const invitedUser = newUsersData?.users?.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (invitedUser) {
      const { data: existingMembership } = await supabase
        .from("tenant_members")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", invitedUser.id)
        .maybeSingle();

      if (!existingMembership) {
        const { error: membershipInsertError } = await supabase.from("tenant_members").insert({
          tenant_id,
          user_id: invitedUser.id,
          role: requestedRole,
          invitation_status: "invited",
          invitation_email: email,
          invited_by: caller.id,
        });
        if (membershipInsertError) throw membershipInsertError;
      }
    }

    return jsonResponse({
      success: true,
      invited: true,
      added: true,
      already_member: false,
      email_sent: true,
      user_id: invitedUser?.id ?? null,
    });
  } catch (err) {
    console.error("invite-team-member error:", err);
    return jsonResponse({
      error: err instanceof Error ? err.message : "Unknown error",
    }, 500);
  }
});
