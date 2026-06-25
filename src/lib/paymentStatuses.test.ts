import { describe, it, expect } from "vitest";
import { PAYMENT_STATUSES, DEFAULT_PAYMENT_STATUS, isKnownPaymentStatus } from "./paymentStatuses";

describe("isKnownPaymentStatus", () => {
  it("accepts every known status", () => {
    for (const s of PAYMENT_STATUSES) {
      expect(isKnownPaymentStatus(s)).toBe(true);
    }
  });

  it("rejects unknown / mistyped values", () => {
    expect(isKnownPaymentStatus("pending")).toBe(false);
    expect(isKnownPaymentStatus("Paid")).toBe(false); // case-sensitive by design
  });

  it("rejects empty / null / undefined", () => {
    expect(isKnownPaymentStatus("")).toBe(false);
    expect(isKnownPaymentStatus(null)).toBe(false);
    expect(isKnownPaymentStatus(undefined)).toBe(false);
  });

  it("default status is itself a known status", () => {
    expect(isKnownPaymentStatus(DEFAULT_PAYMENT_STATUS)).toBe(true);
  });
});
