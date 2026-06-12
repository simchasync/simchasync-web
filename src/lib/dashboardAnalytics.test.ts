import { describe, it, expect } from "vitest";
import {
  getBookingRevenue,
  getTravelFeeExpense,
  getEventOutstanding,
  getDashboardStats,
  type DashboardEvent,
  type DashboardInvoice,
} from "./dashboardAnalytics";

const event = (overrides: Partial<DashboardEvent>): DashboardEvent =>
  ({
    id: "e1",
    event_date: "2026-06-15",
    total_price: 1000,
    travel_fee: 0,
    travel_fee_type: null,
    deposit: 0,
    payment_status: "unpaid",
    ...overrides,
  }) as unknown as DashboardEvent;

describe("getBookingRevenue", () => {
  it("counts customer-billed travel fees as revenue", () => {
    expect(getBookingRevenue(event({ total_price: 1000, travel_fee: 200, travel_fee_type: "charge_customer" }))).toBe(1200);
  });

  it("excludes owner-expense travel fees from revenue", () => {
    expect(getBookingRevenue(event({ total_price: 1000, travel_fee: 200, travel_fee_type: "expense" }))).toBe(1000);
  });
});

describe("getTravelFeeExpense", () => {
  it("is an expense unless billed to the customer", () => {
    expect(getTravelFeeExpense(event({ travel_fee: 200, travel_fee_type: "expense" }))).toBe(200);
    expect(getTravelFeeExpense(event({ travel_fee: 200, travel_fee_type: "charge_customer" }))).toBe(0);
  });
});

describe("getEventOutstanding", () => {
  it("is zero for paid bookings", () => {
    expect(getEventOutstanding(event({ payment_status: "paid", total_price: 1000 }))).toBe(0);
  });

  it("subtracts the deposit for unpaid bookings", () => {
    expect(getEventOutstanding(event({ total_price: 1000, deposit: 300 }))).toBe(700);
  });

  it("never goes negative", () => {
    expect(getEventOutstanding(event({ total_price: 500, deposit: 800 }))).toBe(0);
  });
});

describe("getDashboardStats", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const events = [
    // paid, this month, travel billed to customer
    event({ id: "a", event_date: "2026-06-10", total_price: 1000, travel_fee: 100, travel_fee_type: "charge_customer", payment_status: "paid" }),
    // unpaid with deposit, this month, travel as owner expense
    event({ id: "b", event_date: "2026-06-20", total_price: 2000, deposit: 500, travel_fee: 150, travel_fee_type: "expense" }),
    // unpaid, previous month
    event({ id: "c", event_date: "2026-05-01", total_price: 800 }),
  ];
  const invoices = [
    { id: "i1", status: "paid", amount: 400 },
    { id: "i2", status: "sent", amount: 999 },
  ] as unknown as DashboardInvoice[];

  const stats = getDashboardStats({
    events,
    invoices,
    expenses: [{ amount: 50 } as never],
    colleagueCosts: [{ price: 120 } as never],
    commissions: [{ commission_amount: 80 } as never],
    now,
  });

  it("computes booking counts", () => {
    expect(stats.totalBookings).toBe(3);
    expect(stats.paidBookings).toBe(1);
    expect(stats.unpaidBookings).toBe(2);
  });

  it("computes revenue including customer-billed travel", () => {
    // 1100 (a) + 2000 (b) + 800 (c)
    expect(stats.totalRevenue).toBe(3900);
    expect(stats.revenueReceived).toBe(1100); // only the paid booking
  });

  it("computes outstanding net of deposits", () => {
    // b: 2000 - 500 = 1500; c: 800
    expect(stats.outstanding).toBe(2300);
  });

  it("filters this-month revenue by the provided date", () => {
    expect(stats.thisMonthRevenue).toBe(3100); // a (1100) + b (2000)
  });

  it("aggregates all expense sources", () => {
    // manual 50 + colleagues 120 + commissions 80 + owner travel 150
    expect(stats.totalExpenses).toBe(400);
    expect(stats.netProfit).toBe(3500);
    expect(stats.avgProfitPerBooking).toBe(Math.round(3500 / 3));
  });

  it("totals paid invoices", () => {
    expect(stats.invoicePaid).toBe(400);
    expect(stats.invoicePaidCount).toBe(1);
  });
});
