import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const dashboard = {
  title: "Dashboard",
  upcoming: "Upcoming Events",
  noEvents: "No upcoming events",
  noEventsHint: "Create your first booking to get started",
  overview: "Overview",
  totalRevenue: "Total Revenue",
  received: "received",
  unpaidBookings: "{count} unpaid bookings",
  thisMonth: "This Month",
  eventsCount: "{count} event(s)",
  totalBookings: "Total Bookings",
  paidCount: "{count} paid",
  newBooking: "New Booking",
  recentInvoices: "Recent Invoices",
  noInvoices: "No invoices yet",
  noInvoicesHint: "Create a booking with a deposit to auto-generate invoices",
  viewAllEvents: "View all {count} events",
  viewAllInvoices: "View all {count} invoices",
  noClient: "No client",
  profitAnalytics: "Profit Analytics",
  totalExpenses: "Total Expenses",
  netProfit: "Net Profit",
  avgProfitPerBooking: "Avg Profit / Booking",
  invoicesPaid: "Invoices Paid",
  invoicesCount: "{count} invoices",
  socialTitle: "Social Media Dashboard",
  socialHint: "Analytics and performance metrics will appear here once available.",
  goodMorning: "Good morning",
  goodAfternoon: "Good afternoon",
  goodEvening: "Good evening",
  revenueTrend: "Revenue Trend",
  lastSixMonths: "Booking revenue, last 6 months",
};
const en = {
  app: {
    dashboard,
    clients: { newClient: "New Client" },
    invoices: { newInvoice: "New Invoice" },
    bookings: { types: { wedding: "Wedding" } },
  },
  common: { view: "View", edit: "Edit" },
};
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockUseUserRole = vi.fn();
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock("@/components/bookings/ViewBookingDialog", () => ({
  default: ({ open, event }: { open: boolean; event: { id: string } | null }) =>
    open ? <div data-testid="view-booking-dialog">{event?.id}</div> : null,
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  events: { data: [], error: null },
  invoices: { data: [], error: null },
  event_expenses: { data: [], error: null },
  event_colleagues: { data: [], error: null },
  booking_agents: { data: [], error: null },
};

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedByTable[table]).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn((table: string) => makeBuilder(table));
const mockChannel = vi.fn(() => ({
  on: () => mockChannel(),
  subscribe: () => mockChannel(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    channel: () => {
      const chan = { on: () => chan, subscribe: () => chan };
      return chan;
    },
    removeChannel: vi.fn(),
  },
}));

import Dashboard from "./Dashboard";

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    event_type: "wedding",
    event_date: "2027-05-01",
    payment_status: "unpaid",
    total_price: 1000,
    deposit: 0,
    travel_fee: 0,
    travel_fee_type: "none",
    venue: "Grand Hall",
    clients: { name: "Client A" },
    ...overrides,
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-12345678",
    status: "sent",
    amount: 500,
    description: "Deposit invoice",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<Dashboard />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  mockUseTenantId.mockReset();
  mockUseUserRole.mockReset();
  mockUseSubscription.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockUseUserRole.mockReturnValue({ isSocialOnly: false });
  mockUseSubscription.mockReturnValue({ canAccess: () => false, plan: "starter" });
  resolvedByTable.events = { data: [], error: null };
  resolvedByTable.invoices = { data: [], error: null };
  resolvedByTable.event_expenses = { data: [], error: null };
  resolvedByTable.event_colleagues = { data: [], error: null };
  resolvedByTable.booking_agents = { data: [], error: null };
});

describe("Dashboard", () => {
  it("shows the social-media-only placeholder for social_media_manager role", async () => {
    mockUseUserRole.mockReturnValue({ isSocialOnly: true });
    renderDashboard();
    expect(await screen.findByText("Social Media Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });

  it("shows empty states when there are no events or invoices", async () => {
    renderDashboard();
    expect(await screen.findByText("No upcoming events")).toBeInTheDocument();
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
  });

  it("shows stat cards and the upcoming events / recent invoices lists", async () => {
    resolvedByTable.events = { data: [makeEvent()], error: null };
    resolvedByTable.invoices = { data: [makeInvoice()], error: null };
    renderDashboard();

    expect((await screen.findAllByText("Wedding")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total Revenue").length).toBeGreaterThan(0);
    expect(screen.getByText("Deposit invoice")).toBeInTheDocument();
  });

  it("hides Profit Analytics and Revenue Trend when expenses_profit access is denied", async () => {
    resolvedByTable.events = { data: [makeEvent()], error: null };
    renderDashboard();
    await screen.findAllByText("Wedding");

    expect(screen.queryByText("Profit Analytics")).not.toBeInTheDocument();
    expect(screen.queryByText("Revenue Trend")).not.toBeInTheDocument();
  });

  it("shows Profit Analytics and Revenue Trend when expenses_profit access is allowed", async () => {
    mockUseSubscription.mockReturnValue({ canAccess: () => true, plan: "pro" });
    resolvedByTable.events = { data: [makeEvent()], error: null };
    renderDashboard();
    await screen.findAllByText("Wedding");

    expect(await screen.findByText("Profit Analytics")).toBeInTheDocument();
    expect(screen.getByText("Revenue Trend")).toBeInTheDocument();
  });

  it("opens the view booking dialog when an event's view button is clicked", async () => {
    resolvedByTable.events = { data: [makeEvent()], error: null };
    renderDashboard();
    await screen.findAllByText("Wedding");

    const viewButtons = screen.getAllByTitle("View");
    viewButtons[0].click();

    expect(await screen.findByTestId("view-booking-dialog")).toHaveTextContent("e1");
  });
});
