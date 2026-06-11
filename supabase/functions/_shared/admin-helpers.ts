/// <reference path="./deno-runtime.d.ts" />
import { createClient } from "@supabase/supabase-js";

export type JsonMap = Record<string, unknown>;

const PROD_ORIGIN = "https://simchasync-web.vercel.app";

function isAllowedAdminOrigin(origin: string): boolean {
  if (origin === PROD_ORIGIN || origin === (Deno.env.get("APP_URL") ?? "")) return true;
  // Vercel preview deployments of this project
  if (/^https:\/\/simchasync-web[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  // Local development
  return /^http:\/\/localhost:\d+$/.test(origin);
}

/** Origin-allow-listed CORS for internal admin functions (no wildcard).
 * Call once at the top of the handler: `const corsHeaders = adminCors(req);` */
export function adminCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedAdminOrigin(origin) ? origin : PROD_ORIGIN,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Unknown error";
}

export async function auditLog(
  adminClient: any,
  adminUserId: string,
  action: string,
  targetTenantId?: string,
  targetUserId?: string,
  details?: JsonMap,
) {
  await adminClient.from("admin_audit_logs").insert({
    admin_user_id: adminUserId,
    action,
    target_tenant_id: targetTenantId || null,
    target_user_id: targetUserId || null,
    details: details || {},
  });
}

export function isAdmin(userRoles: string[]) {
  return userRoles.includes("admin");
}

export function isBillingAdmin(userRoles: string[]) {
  return userRoles.includes("billing_admin");
}

export function isSupportAgent(userRoles: string[]) {
  return userRoles.includes("support_agent");
}

export function hasAnyRole(userRoles: string[]) {
  return isAdmin(userRoles) || isBillingAdmin(userRoles) || isSupportAgent(userRoles);
}

export async function authenticate(adminClient: any, authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Unauthorized", status: 401 };
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return { user: null, error: "Unauthorized", status: 401 };
  }
  return { user: userData.user, error: null, status: 200 };
}

export async function getUserRoles(adminClient: any, userId: string) {
  const { data: roles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (roles || []).map((r: { role: string }) => r.role);
}

export function requireRoles(userRoles: string[], required: string[]) {
  if (!required.some((r) => userRoles.includes(r))) {
    return false;
  }
  return true;
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("APP_SECRET_API_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function enrichMembersWithProfiles(adminClient: any, members: any[]) {
  if (!members || members.length === 0) return [];
  const userIds = [...new Set(members.map((m) => m.user_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("user_id, full_name, email, avatar_url")
    .in("user_id", userIds);
  const profileMap: Record<string, any> = {};
  for (const p of (profiles || [])) {
    profileMap[p.user_id] = p;
  }
  return members.map((m) => ({
    ...m,
    profiles: profileMap[m.user_id] || null,
  }));
}

export async function enrichRolesWithProfiles(adminClient: any, roles: any[]) {
  if (!roles || roles.length === 0) return [];
  const userIds = [...new Set(roles.map((r) => r.user_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);
  const profileMap: Record<string, any> = {};
  for (const p of (profiles || [])) {
    profileMap[p.user_id] = p;
  }
  return roles.map((r) => ({
    ...r,
    profiles: profileMap[r.user_id] || null,
  }));
}

export async function enrichLogsWithProfiles(adminClient: any, logs: any[]) {
  if (!logs || logs.length === 0) return [];
  const userIds = [...new Set(logs.map((l) => l.admin_user_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);
  const profileMap: Record<string, any> = {};
  for (const p of (profiles || [])) {
    profileMap[p.user_id] = p;
  }
  return logs.map((l) => ({
    ...l,
    profiles: profileMap[l.admin_user_id] || null,
  }));
}
