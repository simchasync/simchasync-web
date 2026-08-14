import { describe, it, expect } from "vitest";
import { formatTimeUS } from "./formatTime";

describe("formatTimeUS", () => {
  it("formats 24-hour times as US 12-hour times", () => {
    expect(formatTimeUS("18:30")).toBe("6:30 PM");
    expect(formatTimeUS("09:05")).toBe("9:05 AM");
    expect(formatTimeUS("00:00")).toBe("12:00 AM");
    expect(formatTimeUS("12:00")).toBe("12:00 PM");
    expect(formatTimeUS("23:59")).toBe("11:59 PM");
  });

  it("returns empty string for empty input and passes through non-times", () => {
    expect(formatTimeUS("")).toBe("");
    expect(formatTimeUS(null)).toBe("");
    expect(formatTimeUS(undefined)).toBe("");
    expect(formatTimeUS("TBD")).toBe("TBD");
  });
});
