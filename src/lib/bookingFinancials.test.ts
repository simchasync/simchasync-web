import { describe, it, expect } from "vitest";
import { isTravelFeeChargedToCustomer, getEffectiveTotal, computeBalanceDue } from "./bookingFinancials";

describe("isTravelFeeChargedToCustomer", () => {
  it("is true only for charge_customer", () => {
    expect(isTravelFeeChargedToCustomer("charge_customer")).toBe(true);
    expect(isTravelFeeChargedToCustomer("expense")).toBe(false);
    expect(isTravelFeeChargedToCustomer(null)).toBe(false);
    expect(isTravelFeeChargedToCustomer(undefined)).toBe(false);
    expect(isTravelFeeChargedToCustomer("")).toBe(false);
  });
});

describe("getEffectiveTotal", () => {
  it("adds the travel fee when billed to the customer", () => {
    expect(getEffectiveTotal(1000, 150, "charge_customer")).toBe(1150);
  });

  it("excludes the travel fee when it is the owner's expense", () => {
    expect(getEffectiveTotal(1000, 150, "expense")).toBe(1000);
    expect(getEffectiveTotal(1000, 150, null)).toBe(1000);
  });

  it("handles zero values", () => {
    expect(getEffectiveTotal(0, 0, "charge_customer")).toBe(0);
  });
});

describe("computeBalanceDue", () => {
  it("subtracts the deposit from the effective total", () => {
    expect(computeBalanceDue(1000, 300, 0, null)).toBe(700);
  });

  it("includes a customer-billed travel fee in the balance", () => {
    expect(computeBalanceDue(1000, 300, 150, "charge_customer")).toBe(850);
  });

  it("ignores an owner-expense travel fee", () => {
    expect(computeBalanceDue(1000, 300, 150, "expense")).toBe(700);
  });

  it("never goes below zero when overpaid", () => {
    expect(computeBalanceDue(1000, 1500, 0, null)).toBe(0);
    expect(computeBalanceDue(0, 0, 0, null)).toBe(0);
  });
});
