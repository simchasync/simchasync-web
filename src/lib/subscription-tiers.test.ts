import { describe, it, expect } from "vitest";
import { SUBSCRIPTION_TIERS, getTierFromProductId, canAccessFeature, teamMemberLimit } from "./subscription-tiers";

describe("getTierFromProductId", () => {
  it("detects tiers by product id", () => {
    expect(getTierFromProductId(SUBSCRIPTION_TIERS.lite.product_id)).toBe("lite");
    expect(getTierFromProductId(SUBSCRIPTION_TIERS.full.product_id)).toBe("full");
  });

  it("falls back to price id when product id is unknown", () => {
    expect(getTierFromProductId("prod_unknown", SUBSCRIPTION_TIERS.lite.price_id)).toBe("lite");
    expect(getTierFromProductId(null, SUBSCRIPTION_TIERS.full.price_id)).toBe("full");
  });

  it("returns null for unknown ids", () => {
    expect(getTierFromProductId("prod_unknown", "price_unknown")).toBe(null);
    expect(getTierFromProductId(null, null)).toBe(null);
  });

  it("never classifies an empty/missing incoming id as a tier", () => {
    // A blank product/price id from Stripe must not match any tier — even
    // though every tier (incl. Premium) now has non-empty configured ids.
    expect(getTierFromProductId("", "")).toBe(null);
    expect(getTierFromProductId(null, "")).toBe(null);
  });
});

describe("canAccessFeature", () => {
  it("mirrors Lite during an active trial — advanced features stay locked", () => {
    expect(canAccessFeature("trial", null, true, "expenses_profit")).toBe(false);
    expect(canAccessFeature("trial", null, true, "stripe_connect")).toBe(false);
    expect(canAccessFeature("trial", null, true, "team_invites")).toBe(false);
    expect(canAccessFeature("trial", null, true, "booking_page")).toBe(false);
  });

  it("denies after the trial expires", () => {
    expect(canAccessFeature("trial", null, false, "expenses_profit")).toBe(false);
  });

  it("grants Pro (full) and Premium the paid features", () => {
    expect(canAccessFeature("full", "full", false, "expenses_profit")).toBe(true);
    expect(canAccessFeature("premium", "premium", false, "stripe_connect")).toBe(true);
    expect(canAccessFeature("full", "full", false, "team_invites")).toBe(true);
  });

  it("denies Lite the gated features (incl. team invites)", () => {
    expect(canAccessFeature("lite", "lite", false, "expenses_profit")).toBe(false);
    expect(canAccessFeature("lite", "lite", false, "stripe_connect")).toBe(false);
    expect(canAccessFeature("lite", "lite", false, "team_invites")).toBe(false);
  });
});

describe("canAccessFeature social_media gate (parked / disabled)", () => {
  it("is off for every plan, including active trial and Premium", () => {
    expect(canAccessFeature("trial", null, true, "social_media")).toBe(false);
    expect(canAccessFeature("full", "full", false, "social_media")).toBe(false);
    expect(canAccessFeature("premium", "premium", false, "social_media")).toBe(false);
    expect(canAccessFeature("lite", "lite", false, "social_media")).toBe(false);
  });
});

describe("canAccessFeature customer_inquiries (available on every plan)", () => {
  it("is available on Lite, Pro, Premium, and during an active trial", () => {
    expect(canAccessFeature("lite", "lite", false, "customer_inquiries")).toBe(true);
    expect(canAccessFeature("full", "full", false, "customer_inquiries")).toBe(true);
    expect(canAccessFeature("premium", "premium", false, "customer_inquiries")).toBe(true);
    expect(canAccessFeature("trial", null, true, "customer_inquiries")).toBe(true);
  });
});

describe("teamMemberLimit", () => {
  it("lets Pro (full) invite up to 3 teammates", () => {
    expect(teamMemberLimit("full", "full", false)).toBe(3);
  });

  it("lets Premium invite up to 5 teammates", () => {
    expect(teamMemberLimit("premium", "premium", false)).toBe(5);
  });

  it("gives Lite, trial, and unsubscribed workspaces no invites", () => {
    expect(teamMemberLimit("lite", "lite", false)).toBe(0);
    expect(teamMemberLimit(null, "trial", true)).toBe(0);
    expect(teamMemberLimit(null, "none", false)).toBe(0);
  });
});
