import { supabase } from "./supabase";

const ACTION_ROUTING: Record<string, string> = {
  // admin-tenants
  list_tenants: "admin-tenants",
  search_tenants: "admin-tenants",
  update_tenant_notes: "admin-tenants",
  impersonate_tenant: "admin-tenants",
  tenant_detail: "admin-tenants",
  delete_member: "admin-tenants",
  delete_colleague: "admin-tenants",
  delete_tenant: "admin-tenants",
  // admin-billing
  extend_trial: "admin-billing",
  change_plan: "admin-billing",
  remove_override: "admin-billing",
  set_custom_price: "admin-billing",
  resync_stripe: "admin-billing",
  // admin-users
  reset_password: "admin-users",
  invite_tenant: "admin-users",
  deactivate_user: "admin-users",
  delete_user: "admin-users",
  list_all_users: "admin-users",
  // admin-roles
  assign_admin_role: "admin-roles",
  create_admin: "admin-roles",
  remove_admin_role: "admin-roles",
  list_admin_users: "admin-roles",
  find_user_by_email: "admin-roles",
  list_admin_activity: "admin-roles",
  // admin-support
  list_support_tickets: "admin-support",
  get_ticket_replies: "admin-support",
  reply_to_ticket: "admin-support",
  update_ticket_status: "admin-support",
  // admin-audit
  list_audit_logs: "admin-audit",
};

export function getFunctionName(action: string): string {
  const functionName = ACTION_ROUTING[action];
  if (!functionName) {
    throw new Error(`Unknown admin action: ${action}`);
  }
  return functionName;
}

export function adminAction(action: string, body: Record<string, any>) {
  const functionName = getFunctionName(action);
  return supabase.functions.invoke(functionName, {
    body: { action, ...body },
  });
}
