import { describe, it, expect } from "vitest";
import { formatCurrency, buildNavigationAddress } from "./utils";

describe("formatCurrency", () => {
  it("formats whole dollars without decimals", () => {
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(1234)).toBe("$1,234");
  });

  it("rounds to whole dollars", () => {
    expect(formatCurrency(99.99)).toBe("$100");
  });

  it("formats negatives", () => {
    expect(formatCurrency(-500)).toBe("-$500");
  });
});

describe("buildNavigationAddress", () => {
  it("combines venue and location so directions hit the venue", () => {
    expect(buildNavigationAddress("Agua Vista Resort", "Naga City, Philippines")).toBe(
      "Agua Vista Resort, Naga City, Philippines",
    );
  });

  it("falls back to whichever part exists", () => {
    expect(buildNavigationAddress("Agua Vista Resort", "")).toBe("Agua Vista Resort");
    expect(buildNavigationAddress(null, "Naga City")).toBe("Naga City");
  });

  it("trims whitespace and handles empty input", () => {
    expect(buildNavigationAddress("  Venue  ", "  City  ")).toBe("Venue, City");
    expect(buildNavigationAddress("", "")).toBe("");
    expect(buildNavigationAddress(undefined, undefined)).toBe("");
  });
});
