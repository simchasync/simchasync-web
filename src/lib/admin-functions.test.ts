import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("./supabase", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import { getFunctionName, adminAction } from "./admin-functions";

describe("getFunctionName", () => {
  it.each([
    ["list_tenants", "admin-tenants"],
    ["search_tenants", "admin-tenants"],
    ["update_tenant_notes", "admin-tenants"],
    ["impersonate_tenant", "admin-tenants"],
    ["extend_trial", "admin-billing"],
    ["change_plan", "admin-billing"],
    ["remove_override", "admin-billing"],
    ["set_custom_price", "admin-billing"],
    ["resync_stripe", "admin-billing"],
    ["reset_password", "admin-users"],
    ["invite_tenant", "admin-users"],
    ["deactivate_user", "admin-users"],
    ["delete_user", "admin-users"],
    ["list_all_users", "admin-users"],
    ["assign_admin_role", "admin-roles"],
    ["remove_admin_role", "admin-roles"],
    ["list_admin_users", "admin-roles"],
    ["find_user_by_email", "admin-roles"],
    ["list_admin_activity", "admin-roles"],
    ["list_support_tickets", "admin-support"],
    ["get_ticket_replies", "admin-support"],
    ["reply_to_ticket", "admin-support"],
    ["update_ticket_status", "admin-support"],
    ["list_audit_logs", "admin-audit"],
  ])("routes %s to %s", (action, expected) => {
    expect(getFunctionName(action)).toBe(expected);
  });

  it("throws for an unrecognized action", () => {
    expect(() => getFunctionName("some_future_action")).toThrow(/unknown admin action/i);
  });
});

describe("adminAction", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("invokes the routed edge function with the action and body merged", async () => {
    await adminAction("extend_trial", { tenant_id: "t1", days: 14 });
    expect(mockInvoke).toHaveBeenCalledWith("admin-billing", {
      body: { action: "extend_trial", tenant_id: "t1", days: 14 },
    });
  });

  it("throws for an unknown action instead of invoking a function", () => {
    expect(() => adminAction("mystery_action", { foo: "bar" })).toThrow(/unknown admin action/i);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
