import { describe, it, expect } from "vitest";
import { EVENT_TYPES, isKnownEventType } from "./eventTypes";

describe("isKnownEventType", () => {
  it("accepts every known event type", () => {
    for (const t of EVENT_TYPES) {
      expect(isKnownEventType(t)).toBe(true);
    }
  });

  it("rejects custom / unknown values (the 'other' free-text path)", () => {
    expect(isKnownEventType("birthday")).toBe(false);
    expect(isKnownEventType("other")).toBe(false);
    expect(isKnownEventType("Wedding")).toBe(false); // case-sensitive by design
  });

  it("rejects empty / null / undefined", () => {
    expect(isKnownEventType("")).toBe(false);
    expect(isKnownEventType(null)).toBe(false);
    expect(isKnownEventType(undefined)).toBe(false);
  });
});
