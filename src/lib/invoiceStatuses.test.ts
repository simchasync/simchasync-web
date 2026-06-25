import { describe, it, expect } from "vitest";
import { INVOICE_STATUSES, isKnownInvoiceStatus } from "./invoiceStatuses";

describe("isKnownInvoiceStatus", () => {
  it("accepts every known status", () => {
    for (const s of INVOICE_STATUSES) {
      expect(isKnownInvoiceStatus(s)).toBe(true);
    }
  });

  it("rejects unknown / mistyped values", () => {
    expect(isKnownInvoiceStatus("pending")).toBe(false);
    expect(isKnownInvoiceStatus("Paid")).toBe(false); // case-sensitive by design
  });

  it("rejects empty / null / undefined", () => {
    expect(isKnownInvoiceStatus("")).toBe(false);
    expect(isKnownInvoiceStatus(null)).toBe(false);
    expect(isKnownInvoiceStatus(undefined)).toBe(false);
  });
});
