import { describe, it, expect } from "vitest";
import { TRAVEL_FEE_TYPES, DEFAULT_TRAVEL_FEE_TYPE, isKnownTravelFeeType } from "./travelFeeTypes";

describe("isKnownTravelFeeType", () => {
  it("accepts every known type", () => {
    for (const t of TRAVEL_FEE_TYPES) {
      expect(isKnownTravelFeeType(t)).toBe(true);
    }
  });

  it("rejects unknown / mistyped values", () => {
    expect(isKnownTravelFeeType("absorbed")).toBe(false);
    expect(isKnownTravelFeeType("Expense")).toBe(false); // case-sensitive by design
  });

  it("rejects empty / null / undefined", () => {
    expect(isKnownTravelFeeType("")).toBe(false);
    expect(isKnownTravelFeeType(null)).toBe(false);
    expect(isKnownTravelFeeType(undefined)).toBe(false);
  });

  it("default type is itself a known type", () => {
    expect(isKnownTravelFeeType(DEFAULT_TRAVEL_FEE_TYPE)).toBe(true);
  });
});
