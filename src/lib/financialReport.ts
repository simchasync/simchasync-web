// Single source of truth for the financial (P&L) report model, shared by the
// on-screen Finance page and the printable PDF template so the figures and
// line items can never drift apart or be re-hardcoded in two places.

export type PnLLineKind = "income" | "expense" | "total";

export interface PnLLine {
  key: string;
  label: string;
  /** Signed amount: income/total positive, expenses negative. */
  amount: number;
  kind: PnLLineKind;
}

/** Raw totals computed on the Finance page, passed in so this stays pure. */
export interface ReportTotals {
  totalRevenue: number;
  totalWorkspaceExpenses: number;
  totalEventExpenses: number;
  totalTravelFees: number;
  totalColleagueCosts: number;
  totalCommissions: number;
}

/** Build the ordered P&L statement lines from the period totals. */
export function buildPnLLines(t: ReportTotals): PnLLine[] {
  const lines: PnLLine[] = [
    { key: "revenue", label: "Booking Revenue", amount: t.totalRevenue, kind: "income" },
    { key: "general", label: "General Expenses", amount: -t.totalWorkspaceExpenses, kind: "expense" },
    { key: "perEvent", label: "Per-Event Expenses", amount: -t.totalEventExpenses, kind: "expense" },
    { key: "travel", label: "Travel Fees", amount: -t.totalTravelFees, kind: "expense" },
    { key: "musician", label: "Musician Costs", amount: -t.totalColleagueCosts, kind: "expense" },
    { key: "commissions", label: "Agent Commissions", amount: -t.totalCommissions, kind: "expense" },
  ];
  const netProfit = lines.reduce((sum, l) => sum + l.amount, 0);
  lines.push({ key: "net", label: "Net Profit", amount: netProfit, kind: "total" });
  return lines;
}

export function getNetProfit(t: ReportTotals): number {
  return buildPnLLines(t).find((l) => l.key === "net")?.amount ?? 0;
}

export function getTotalExpenses(t: ReportTotals): number {
  return (
    t.totalWorkspaceExpenses +
    t.totalEventExpenses +
    t.totalTravelFees +
    t.totalColleagueCosts +
    t.totalCommissions
  );
}

/** App-wide USD formatting (matches the rest of the app's `$` display). */
export function formatCurrency(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Profit margin as a percentage of revenue, or null when there's no revenue. */
export function getProfitMargin(t: ReportTotals): number | null {
  if (t.totalRevenue <= 0) return null;
  return (getNetProfit(t) / t.totalRevenue) * 100;
}
