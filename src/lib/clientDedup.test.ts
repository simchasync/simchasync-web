import { describe, it, expect } from "vitest";
import { normalizeText, normalizeEmail, normalizePhone } from "./clientDedup";

describe("normalizeText", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeText("  Cohen Family  ")).toBe("Cohen Family");
  });

  it("returns null for empty, whitespace-only, null, or undefined", () => {
    expect(normalizeText("")).toBeNull();
    expect(normalizeText("   ")).toBeNull();
    expect(normalizeText(null)).toBeNull();
    expect(normalizeText(undefined)).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Jane@Example.COM  ")).toBe("jane@example.com");
  });

  it("returns null for empty, null, or undefined", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("strips formatting characters down to digits", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
    expect(normalizePhone("+1 555.123.4567")).toBe("15551234567");
  });

  it("treats differently-formatted equivalent numbers as equal once normalized", () => {
    expect(normalizePhone("555-123-4567")).toBe(normalizePhone("(555) 123 4567"));
  });

  it("returns null when there are no digits, or input is null/undefined", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});
