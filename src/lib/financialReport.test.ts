import { describe, it, expect } from "vitest";
import {
  buildPnLLines,
  getNetProfit,
  getTotalExpenses,
  getProfitMargin,
  formatCurrency,
  type ReportTotals,
} from "./financialReport";

const totals: ReportTotals = {
  totalRevenue: 10000,
  totalWorkspaceExpenses: 1000,
  totalEventExpenses: 500,
  totalTravelFees: 250,
  totalColleagueCosts: 750,
  totalCommissions: 1500,
};

describe("buildPnLLines", () => {
  it("lists revenue first, expenses negative, net profit last", () => {
    const lines = buildPnLLines(totals);
    expect(lines[0]).toMatchObject({ key: "revenue", amount: 10000, kind: "income" });
    expect(lines.find((l) => l.key === "general")?.amount).toBe(-1000);
    expect(lines.find((l) => l.key === "commissions")?.amount).toBe(-1500);
    const net = lines[lines.length - 1];
    expect(net.key).toBe("net");
    expect(net.kind).toBe("total");
  });

  it("net profit equals revenue minus every expense line", () => {
    // 10000 - (1000+500+250+750+1500) = 6000
    expect(getNetProfit(totals)).toBe(6000);
    expect(getTotalExpenses(totals)).toBe(4000);
  });

  it("net can go negative when expenses exceed revenue", () => {
    expect(getNetProfit({ ...totals, totalRevenue: 0 })).toBe(-4000);
  });
});

describe("getProfitMargin", () => {
  it("is a percentage of revenue", () => {
    expect(getProfitMargin(totals)).toBeCloseTo(60);
  });
  it("is null when there is no revenue (no divide-by-zero)", () => {
    expect(getProfitMargin({ ...totals, totalRevenue: 0 })).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("formats with 2 decimals and a leading sign for negatives", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(-1000)).toBe("-$1,000.00");
    expect(formatCurrency(0)).toBe("$0.00");
  });
});
