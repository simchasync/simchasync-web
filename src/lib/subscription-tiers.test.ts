import { describe, it, expect } from "vitest";
import { SUBSCRIPTION_TIERS, getTierFromProductId, canAccessFeature } from "./subscription-tiers";

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
  it("grants everything during an active trial", () => {
    expect(canAccessFeature("trial", null, true, "expenses_profit")).toBe(true);
    expect(canAccessFeature("trial", null, true, "stripe_connect")).toBe(true);
  });

  it("denies after the trial expires", () => {
    expect(canAccessFeature("trial", null, false, "expenses_profit")).toBe(false);
  });

  it("grants Pro (full) and Premium everything", () => {
    expect(canAccessFeature("full", "full", false, "expenses_profit")).toBe(true);
    expect(canAccessFeature("premium", "premium", false, "social_media")).toBe(true);
  });

  it("denies Lite the gated features", () => {
    expect(canAccessFeature("lite", "lite", false, "expenses_profit")).toBe(false);
    expect(canAccessFeature("lite", "lite", false, "stripe_connect")).toBe(false);
    expect(canAccessFeature("lite", "lite", false, "social_media")).toBe(false);
  });
});
