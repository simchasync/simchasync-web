import { describe, it, expect } from "vitest";
import { USER_ROLES, isKnownUserRole } from "./userRoles";

describe("isKnownUserRole", () => {
  it("accepts every known role", () => {
    for (const r of USER_ROLES) {
      expect(isKnownUserRole(r)).toBe(true);
    }
  });

  it("rejects unknown / mistyped values", () => {
    expect(isKnownUserRole("admin")).toBe(false); // app-level role, not a membership role
    expect(isKnownUserRole("Owner")).toBe(false); // case-sensitive by design
  });

  it("rejects empty / null / undefined", () => {
    expect(isKnownUserRole("")).toBe(false);
    expect(isKnownUserRole(null)).toBe(false);
    expect(isKnownUserRole(undefined)).toBe(false);
  });
});
