import { describe, it, expect } from "vitest";
import { toHebrewDate } from "./hebrewDate";

// Output text depends on the Intl Hebrew calendar in the runtime, so we assert
// behaviour (non-empty, stable, accepts Date or string) rather than exact glyphs.
describe("toHebrewDate", () => {
  it("returns a non-empty Hebrew date string for a valid date", () => {
    const out = toHebrewDate(new Date("2026-06-15T00:00:00Z"));
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("accepts a date string and a Date object equivalently", () => {
    const fromStr = toHebrewDate("2026-06-15");
    const fromDate = toHebrewDate(new Date("2026-06-15"));
    expect(fromStr).toBe(fromDate);
  });

  it("returns an empty string for an invalid date", () => {
    expect(toHebrewDate("not-a-date")).toBe("");
  });
});
