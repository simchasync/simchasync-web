import { endOfMonth, isWithinInterval, startOfMonth } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { getEffectiveTotal, isTravelFeeChargedToCustomer } from "@/lib/bookingFinancials";

export type DashboardEvent = Database["public"]["Tables"]["events"]["Row"] & {
  clients?: { name: string | null } | null;
};

export type DashboardInvoice = Database["public"]["Tables"]["invoices"]["Row"];
export type EventExpenseRow = Database["public"]["Tables"]["event_expenses"]["Row"];
export type EventColleagueRow = Database["public"]["Tables"]["event_colleagues"]["Row"];
export type BookingAgentCommissionRow = Pick<Database["public"]["Tables"]["booking_agents"]["Row"], "commission_amount" | "event_id"> & {
  agents?: { name?: string | null; tenant_id?: string } | null;
};

export const paymentStatusBadge: Record<Database["public"]["Enums"]["payment_status"], { label: string; className: string }> = {
  paid: {
    label: "Paid",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  partial: {
    label: "Partial",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  unpaid: {
    label: "Unpaid",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  },
};

export const invoiceStatusBadge: Record<string, { iconClassName: string; chipClassName: string }> = {
  paid: {
    iconClassName: "bg-emerald-500/10 text-emerald-500",
    chipClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  sent: {
    iconClassName: "bg-amber-500/10 text-amber-500",
    chipClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
};

export const defaultInvoiceStatusBadge = {
  iconClassName: "bg-muted text-muted-foreground",
  chipClassName: "bg-muted text-muted-foreground border-border",
};

export type DashboardStats = {
  totalBookings: number;
  paidBookings: number;
  unpaidBookings: number;
  totalRevenue: number;
  revenueReceived: number;
  outstanding: number;
  thisMonthRevenue: number;
  totalTravelFees: number;
  totalTravelRevenue: number;
  totalManualExpenses: number;
  totalColleagueCosts: number;
  totalCommissions: number;
  totalExpenses: number;
  netProfit: number;
  avgProfitPerBooking: number;
  invoicePaid: number;
  invoicePaidCount: number;
};

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const isPaid = (status: Database["public"]["Enums"]["payment_status"] | null | undefined) => status === "paid";
const isThisMonth = (dateString: string, now: Date) => {
  const date = new Date(dateString);
  return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
};

const sum = <T,>(items: T[], selector: (item: T) => number) => items.reduce((sumValue, item) => sumValue + selector(item), 0);

export const getBookingRevenue = (event: DashboardEvent) =>
  getEffectiveTotal(toNumber(event.total_price), toNumber(event.travel_fee), event.travel_fee_type);

export const getTravelFeeExpense = (event: DashboardEvent) =>
  isTravelFeeChargedToCustomer(event.travel_fee_type) ? 0 : toNumber(event.travel_fee);

export const getEventOutstanding = (event: DashboardEvent) =>
  !isPaid(event.payment_status) ? Math.max(getBookingRevenue(event) - toNumber(event.deposit), 0) : 0;

export const getDashboardStats = (args: {
  events: DashboardEvent[];
  invoices: DashboardInvoice[];
  expenses: EventExpenseRow[];
  colleagueCosts: EventColleagueRow[];
  commissions: BookingAgentCommissionRow[];
  now?: Date;
}): DashboardStats => {
  const now = args.now ?? new Date();
  const totalBookings = args.events.length;
  const paidBookings = args.events.filter((event) => isPaid(event.payment_status)).length;
  const unpaidBookings = totalBookings - paidBookings;
  const totalTravelFees = sum(args.events, getTravelFeeExpense);
  const totalTravelRevenue = sum(args.events, (event) =>
    isTravelFeeChargedToCustomer(event.travel_fee_type) ? toNumber(event.travel_fee) : 0,
  );
  const totalRevenue = sum(args.events, getBookingRevenue);
  const revenueReceived = sum(args.events.filter((event) => isPaid(event.payment_status)), getBookingRevenue);
  const outstanding = sum(args.events, getEventOutstanding);
  const thisMonthRevenue = sum(args.events.filter((event) => isThisMonth(event.event_date, now)), getBookingRevenue);
  const totalManualExpenses = sum(args.expenses, (expense) => toNumber(expense.amount));
  const totalColleagueCosts = sum(args.colleagueCosts, (colleague) => toNumber(colleague.price));
  const totalCommissions = sum(args.commissions, (commission) => toNumber(commission.commission_amount));
  const totalExpenses = totalManualExpenses + totalColleagueCosts + totalCommissions + totalTravelFees;
  const netProfit = totalRevenue - totalExpenses;
  const avgProfitPerBooking = totalBookings > 0 ? Math.round(netProfit / totalBookings) : 0;
  const invoicePaid = sum(args.invoices.filter((invoice) => invoice.status === "paid"), (invoice) => toNumber(invoice.amount));
  const invoicePaidCount = args.invoices.filter((invoice) => invoice.status === "paid").length;

  return {
    totalBookings,
    paidBookings,
    unpaidBookings,
    totalRevenue,
    revenueReceived,
    outstanding,
    thisMonthRevenue,
    totalTravelFees,
    totalTravelRevenue,
    totalManualExpenses,
    totalColleagueCosts,
    totalCommissions,
    totalExpenses,
    netProfit,
    avgProfitPerBooking,
    invoicePaid,
    invoicePaidCount,
  };
};
