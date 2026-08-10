/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { emailShell, escapeHtml, getAppOrigin, sendBrandedEmail } from "../_shared/brandedEmail.ts";

const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function getWorkspaceLimits() {
  const raw = Deno.env.get("WORKSPACE_LIMITS_CONFIG");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      console.warn("[ensure-user-onboarding] Invalid WORKSPACE_LIMITS_CONFIG, using defaults");
    }
  }
  return { maxWorkspaces: 1, features: ["stripe_connect", "social_media", "expenses_profit"] };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("APP_SECRET_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: true, skipped: "no-auth" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user) {
      console.log("[ensure-user-onboarding] Auth failed:", userError?.message);
      return new Response(JSON.stringify({ ok: false, error: "auth-failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayName = String(user.user_metadata?.full_name || user.email || "User");
    const safeEmail = user.email ?? null;

    const metaPhone = String(user.user_metadata?.phone ?? "").trim() || null;

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    // A "new signup" is a genuinely new user, counted once we actually have a
    // phone: email signups have it immediately; Google users provide it on the
    // /auth/phone step (which re-runs onboarding).
    let isNewSignup = false;
    if (!existingProfile) {
      const { error: profileInsertError } = await admin.from("profiles").insert({
        user_id: user.id,
        full_name: displayName,
        email: safeEmail,
        phone: metaPhone,
        has_used_trial: false,
      });
      if (profileInsertError) throw profileInsertError;
      isNewSignup = !!metaPhone;
    } else if (!existingProfile.phone && metaPhone) {
      // Existing profile that just gained a phone (Google user finishing the
      // phone step) — sync profiles.phone so it shows in the admin panel, and
      // treat this as the signup moment.
      await admin.from("profiles").update({ phone: metaPhone }).eq("user_id", user.id);
      isNewSignup = true;
    }

    // Notify the team so they can reach out to the new user. Fire-and-forget:
    // a failed notification must never block onboarding.
    if (isNewSignup) {
      try {
        const notifyTo = Deno.env.get("SIGNUP_NOTIFY_EMAIL") ?? "simchasync@gmail.com";
        await sendBrandedEmail(
          notifyTo,
          `New SimchaSync signup: ${displayName}`,
          emailShell(
            "A new user just signed up",
            `<p><strong>${escapeHtml(displayName)}</strong> just created a SimchaSync account.</p>` +
              `<p>Email: <strong>${escapeHtml(safeEmail ?? "—")}</strong><br>` +
              `Phone: <strong>${escapeHtml(metaPhone ?? "—")}</strong></p>` +
              `<p>Reach out to welcome them.</p>`,
            "Open SimchaSync",
            getAppOrigin(req),
          ),
        );
      } catch (notifyErr) {
        console.error("[ensure-user-onboarding] signup notification failed:", notifyErr);
      }
    }

    const { data: acceptedCount, error: acceptError } = await admin.rpc(
      "accept_pending_workspace_invitations",
      { _user_id: user.id }
    );
    if (acceptError) throw acceptError;

    console.log("[ensure-user-onboarding] Accepted pending invites:", acceptedCount ?? 0);

    const { data: memberships, error: membershipsError } = await admin
      .from("tenant_members")
      .select("tenant_id, role, invitation_status")
      .eq("user_id", user.id)
      .order("created_at");

    if (membershipsError) throw membershipsError;

    const hasAnyMembership = memberships && memberships.length > 0;
    const ownerMembership = memberships?.find(
      (m: any) => m.role === "owner" && m.invitation_status === "accepted"
    );

    let ownerTenantId = ownerMembership?.tenant_id ?? null;
    let ownerWorkspaceCreated = false;

    if (!ownerTenantId) {
      const workspaceSlug = `${slugify(displayName || "workspace")}-${user.id.slice(0, 8)}`;

      const { data: createdTenant, error: tenantError } = await admin
        .from("tenants")
        .insert({
          name: `${displayName}'s Workspace`,
          slug: workspaceSlug,
          plan: "trial",
          stripe_subscription_status: "trial",
          is_primary_workspace: true,
        })
        .select("id")
        .single();

      if (tenantError || !createdTenant) throw tenantError ?? new Error("Failed to create workspace");

      const { data: existingOwnerRow } = await admin
        .from("tenant_members")
        .select("id")
        .eq("tenant_id", createdTenant.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingOwnerRow) {
        const { error: ownerInsertError } = await admin.from("tenant_members").insert({
          tenant_id: createdTenant.id,
          user_id: user.id,
          role: "owner",
        });
        if (ownerInsertError) throw ownerInsertError;
      }

      const workspaceLimits = getWorkspaceLimits();

      await admin.from("workspace_subscriptions").upsert(
        {
          workspace_id: createdTenant.id,
          user_id: user.id,
          plan_id: "trial",
          subscription_status: "trial",
          features_locked: false,
          workspace_limits: workspaceLimits,
        },
        { onConflict: "workspace_id" }
      );

      ownerTenantId = createdTenant.id;
      ownerWorkspaceCreated = true;
    }

    const tenantIdToReturn = memberships?.[0]?.tenant_id ?? ownerTenantId;

    return new Response(
      JSON.stringify({
        ok: true,
        tenant_id: tenantIdToReturn,
        owner_tenant_id: ownerTenantId,
        owner_workspace_created: ownerWorkspaceCreated,
        initialized: !hasAnyMembership || ownerWorkspaceCreated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ensure-user-onboarding] Error:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
