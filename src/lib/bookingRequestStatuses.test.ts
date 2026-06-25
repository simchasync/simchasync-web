import { describe, it, expect } from "vitest";
import { BOOKING_REQUEST_STATUSES, isKnownBookingRequestStatus } from "./bookingRequestStatuses";

describe("isKnownBookingRequestStatus", () => {
  it("accepts every known status", () => {
    for (const s of BOOKING_REQUEST_STATUSES) {
      expect(isKnownBookingRequestStatus(s)).toBe(true);
    }
  });

  it("rejects unknown / mistyped values", () => {
    expect(isKnownBookingRequestStatus("pending")).toBe(false);
    expect(isKnownBookingRequestStatus("New")).toBe(false); // case-sensitive by design
  });

  it("rejects empty / null / undefined", () => {
    expect(isKnownBookingRequestStatus("")).toBe(false);
    expect(isKnownBookingRequestStatus(null)).toBe(false);
    expect(isKnownBookingRequestStatus(undefined)).toBe(false);
  });
});
