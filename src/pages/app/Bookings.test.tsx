import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { en } from "@/i18n/en";
import { format, addDays, subDays } from "date-fns";

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

vi.mock("@/hooks/useRealtimeInvalidate", () => ({
  useRealtimeInvalidate: () => undefined,
}));

vi.mock("@/hooks/useGoogleCalendar", () => ({
  syncEventToCalendar: vi.fn().mockResolvedValue(undefined),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("@/components/bookings/BookingCalendar", () => ({
  default: () => <div data-testid="booking-calendar" />,
}));
vi.mock("@/components/bookings/ViewBookingDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/BookingRequests", () => ({
  default: () => <div data-testid="booking-requests" />,
  useBookingRequestCount: () => 0,
}));
vi.mock("@/components/bookings/AgentAssignmentSection", () => ({
  default: () => <div data-testid="agent-section" />,
}));
vi.mock("@/components/bookings/InlineClientDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/bookings/PaymentsSection", () => ({
  default: () => <div data-testid="payments-section" />,
}));
vi.mock("@/components/bookings/SongsSection", () => ({
  default: () => <div data-testid="songs-section" />,
}));
vi.mock("@/components/bookings/AttachmentsSection", () => ({
  default: () => <div data-testid="attachments-section" />,
}));
vi.mock("@/components/bookings/VenueAutocomplete", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="venue-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/components/bookings/LocationAutocomplete", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="location-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/components/bookings/EventTypeSelect", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="event-type-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="wedding">Wedding</option>
      <option value="bar_mitzvah">Bar Mitzvah</option>
    </select>
  ),
}));
vi.mock("@/components/bookings/SectionLabel", () => ({
  default: ({ title }: { title: string }) => <span>{title}</span>,
}));
vi.mock("@/components/bookings/NavigateButton", () => ({
  default: () => null,
}));
vi.mock("@/components/bookings/EventTimingSection", () => ({
  default: () => <div data-testid="timing-section" />,
}));
vi.mock("@/components/bookings/ColleaguesSection", () => ({
  default: () => <div data-testid="colleagues-section" />,
}));
vi.mock("@/components/bookings/ExpensesProfitSection", () => ({
  default: () => <div data-testid="expenses-section" />,
}));
vi.mock("@/components/clients/ClientHistoryDialog", () => ({
  default: () => null,
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────
type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  __table: string;
  __isMutation: boolean;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

// Query results (list queries)
const queryResults: Record<string, unknown> = {
  events: { data: [], error: null },
  clients: { data: [], error: null },
  // auto_generate_invoices=false keeps create tests focused on booking itself
  tenants: { data: { auto_generate_invoices: false }, error: null },
  invoices: { data: [], error: null },
  event_payments: { data: [], error: null },
  booking_agents: { data: [], error: null },
};

// Mutation results (insert/update/delete return values)
const mutationResults: Record<string, unknown> = {
  events: { data: null, error: null },
  invoices: { data: null, error: null },
};

let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const b = { __table: table, __isMutation: false } as Builder;
  const self = () => b;
  b.select = vi.fn(self);
  b.eq = vi.fn(self);
  b.order = vi.fn(self);
  b.single = vi.fn(self);
  b.not = vi.fn(self);
  b.ilike = vi.fn(self);
  b.neq = vi.fn(self);
  b.maybeSingle = vi.fn(self);
  b.insert = vi.fn(() => { b.__isMutation = true; return b; });
  b.update = vi.fn(() => { b.__isMutation = true; return b; });
  b.delete = vi.fn(() => { b.__isMutation = true; return b; });
  b.then = (resolve, reject) => {
    const result = b.__isMutation
      ? (mutationResults[table] ?? { data: null, error: null })
      : (queryResults[table] ?? { data: null, error: null });
    return Promise.resolve(result).then(resolve, reject);
  };
  return b;
}

const mockFrom = vi.fn((table: string) => {
  const b = makeBuilder(table);
  builders.push(b);
  return b;
});

const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import Bookings from "./Bookings";

// ── Helpers ───────────────────────────────────────────────────────────────────
const FUTURE = format(addDays(new Date(), 30), "yyyy-MM-dd");
const PAST = format(subDays(new Date(), 10), "yyyy-MM-dd");

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt1",
    tenant_id: "tenant-1",
    client_id: "c1",
    event_date: FUTURE,
    event_type: "wedding",
    venue: "The Grand Hall",
    location: "Tel Aviv",
    total_price: 5000,
    deposit: 1000,
    balance_due: 4000,
    payment_status: "unpaid",
    deposit_status: "unpaid",
    due_date: null,
    notes: null,
    hebrew_date: "כ׳ תמוז",
    travel_fee: 0,
    travel_fee_type: "expense",
    chuppah_time: null,
    meal_time: null,
    first_dance_time: null,
    second_dance_time: null,
    mitzvah_tanz_time: null,
    event_start_time: null,
    clients: { name: "John Doe" },
    ...overrides,
  };
}

function renderBookings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<Bookings />, { wrapper });
}

function mutationBuilders(table: string) {
  return builders.filter((b) => b.__table === table && b.__isMutation);
}

// First date input in the dialog = event_date field
function dialogDateInput() {
  return screen.getByRole("dialog").querySelector('input[type="date"]') as HTMLInputElement;
}

beforeEach(() => {
  mockFrom.mockClear();
  mockRpc.mockClear();
  mockToast.mockReset();
  mockNavigate.mockReset();
  mockUseTenantId.mockReset();
  mockUseUserRole.mockReset();
  mockUseSubscription.mockReset();
  builders = [];

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockUseUserRole.mockReturnValue({ canWrite: true, role: "owner", isLoading: false });
  mockUseSubscription.mockReturnValue({ canAccess: () => true, loading: false, workspaceActive: true });

  queryResults.events = { data: [], error: null };
  queryResults.clients = { data: [], error: null };
  queryResults.tenants = { data: { auto_generate_invoices: false }, error: null };
  queryResults.invoices = { data: [], error: null };
  queryResults.event_payments = { data: [], error: null };
  queryResults.booking_agents = { data: [], error: null };
  mutationResults.events = { data: null, error: null };
  mutationResults.invoices = { data: null, error: null };
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Bookings", () => {
  it("shows empty state when there are no events", async () => {
    renderBookings();
    expect(await screen.findByText("No events match your filters")).toBeInTheDocument();
  });

  it("shows New Event button for canWrite role", async () => {
    renderBookings();
    expect(await screen.findByRole("button", { name: /new event/i })).toBeInTheDocument();
  });

  it("hides New Event button when canWrite is false", async () => {
    mockUseUserRole.mockReturnValue({ canWrite: false, role: "booking_manager", isLoading: false });
    renderBookings();
    await screen.findByText("No events match your filters");
    expect(screen.queryByRole("button", { name: /new event/i })).not.toBeInTheDocument();
  });

  it("lists events with client name and balance due", async () => {
    queryResults.events = { data: [makeEvent()], error: null };
    renderBookings();
    // Client name appears in both mobile card and desktop table
    expect((await screen.findAllByText("John Doe")).length).toBeGreaterThan(0);
    // "$4,000" also appears in the Outstanding stat card — scope to table to be specific
    const table = screen.getByRole("table");
    expect(within(table).getByText("$4,000")).toBeInTheDocument();
  });

  it("shows stat cards when events are present", async () => {
    queryResults.events = {
      data: [
        makeEvent({ id: "e1", payment_status: "paid", balance_due: 0 }),
        makeEvent({ id: "e2", payment_status: "unpaid", balance_due: 3000 }),
      ],
      error: null,
    };
    renderBookings();
    expect(await screen.findByText(en.app.dashboard.totalBookings)).toBeInTheDocument();
    expect(screen.getByText(en.app.dashboard.upcoming)).toBeInTheDocument();
    expect(screen.getByText(en.app.dashboard.outstanding)).toBeInTheDocument();
  });

  it("filters events by payment status", async () => {
    queryResults.events = {
      data: [
        makeEvent({ id: "e1", payment_status: "paid", balance_due: 0, clients: { name: "Alice" } }),
        makeEvent({ id: "e2", payment_status: "unpaid", balance_due: 4000, clients: { name: "Bob" } }),
      ],
      error: null,
    };
    renderBookings();
    await screen.findAllByText("Alice");

    fireEvent.click(screen.getByRole("button", { name: /^paid$/i }));

    await waitFor(() => expect(screen.queryAllByText("Bob")).toHaveLength(0));
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
  });

  it("filters events by date", async () => {
    const laterDate = format(addDays(new Date(), 60), "yyyy-MM-dd");
    queryResults.events = {
      data: [
        makeEvent({ id: "e1", event_date: FUTURE, clients: { name: "Alice" } }),
        makeEvent({ id: "e2", event_date: laterDate, clients: { name: "Bob" } }),
      ],
      error: null,
    };
    renderBookings();
    await screen.findAllByText("Alice");

    // "Sort by Date" label is linked via htmlFor to the date filter input
    fireEvent.change(screen.getByLabelText(en.app.bookings.date), { target: { value: FUTURE } });

    await waitFor(() => expect(screen.queryAllByText("Bob")).toHaveLength(0));
  });

  it("opens the New Event dialog with create title", async () => {
    renderBookings();
    fireEvent.click(await screen.findByRole("button", { name: /new event/i }));
    await screen.findByRole("dialog");
    // DialogTitle = "{common.create} {bookings.title.toLowerCase()}" = "Create bookings"
    expect(screen.getByText("Create bookings")).toBeInTheDocument();
  });

  it("blocks past dates when creating a new booking", async () => {
    renderBookings();
    fireEvent.click(await screen.findByRole("button", { name: /new event/i }));
    await screen.findByRole("dialog");

    fireEvent.change(dialogDateInput(), { target: { value: PAST } });
    // Use fireEvent.submit to bypass the HTML min-attribute constraint validation in JSDOM,
    // which would otherwise block the submit event before the React handler fires.
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Past dates are not allowed", variant: "destructive" }),
      );
    });
  });

  it("creates a new booking and shows success toast", async () => {
    const newEvent = makeEvent({ id: "new-evt" });
    mutationResults.events = { data: newEvent, error: null };

    renderBookings();
    fireEvent.click(await screen.findByRole("button", { name: /new event/i }));
    await screen.findByRole("dialog");

    fireEvent.change(dialogDateInput(), { target: { value: FUTURE } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Booking created successfully" }),
      );
    });
    expect(mutationBuilders("events").length).toBeGreaterThan(0);
  });

  it("opens the confirm dialog before deleting a booking", async () => {
    queryResults.events = { data: [makeEvent()], error: null };
    renderBookings();
    await screen.findAllByText("John Doe");

    // Desktop table renders "Delete" text buttons; mobile uses icon-only (no accessible name)
    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);

    expect(await screen.findByText(en.app.bookings.confirmDeleteTitle)).toBeInTheDocument();
  });

  it("deletes a booking after confirming", async () => {
    queryResults.events = { data: [makeEvent()], error: null };
    renderBookings();
    await screen.findAllByText("John Doe");

    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    await screen.findByText(en.app.bookings.confirmDeleteTitle);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.common.delete, "i") }));

    await waitFor(() => {
      expect(mutationBuilders("events").some((b) => b.delete.mock.calls.length > 0)).toBe(true);
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Event deleted" }));
    });
  });

  it("allows editing a past booking without changing its date", async () => {
    const pastEvent = makeEvent({ id: "past-evt", event_date: PAST });
    mutationResults.events = { data: pastEvent, error: null };
    queryResults.events = { data: [pastEvent], error: null };
    renderBookings();
    await screen.findAllByText("John Doe");

    // Both mobile and desktop render "Edit" text buttons
    fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await screen.findByRole("dialog");

    // Save without touching the date — past-date guard should not fire
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: "Past dates are not allowed" }),
      );
    });
  });

  it("blocks creating a $0 invoice via the Invoice button", async () => {
    const zeroEvent = makeEvent({ total_price: 0, deposit: 0, balance_due: 0 });
    queryResults.events = { data: [zeroEvent], error: null };
    renderBookings();
    await screen.findAllByText("John Doe");

    fireEvent.click(screen.getByRole("button", { name: /invoice/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });

  it("uses stored balance_due value, not total minus deposit", async () => {
    // balance_due=3500 but total(5000) - deposit(1000) = 4000 — stored value wins
    queryResults.events = {
      data: [makeEvent({ total_price: 5000, deposit: 1000, balance_due: 3500 })],
      error: null,
    };
    renderBookings();
    await screen.findAllByText("John Doe");
    // "$3,500" also appears in the Outstanding stat card — scope to table to be specific
    const table = screen.getByRole("table");
    expect(within(table).getByText("$3,500")).toBeInTheDocument();
  });

  it("renders Calendar and Requests tabs in the tab list", async () => {
    renderBookings();
    await screen.findByRole("button", { name: /new event/i });

    const tabs = screen.getAllByRole("tab");
    const labels = tabs.map((t) => t.textContent ?? "");
    expect(labels.some((l) => /calendar/i.test(l))).toBe(true);
    expect(labels.some((l) => /requests/i.test(l))).toBe(true);
  });

  it("hides Requests tab for member role", async () => {
    mockUseUserRole.mockReturnValue({ canWrite: false, role: "member", isLoading: false });
    mockRpc.mockResolvedValue({ data: [], error: null });
    renderBookings();
    await screen.findByText("No events match your filters");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.every((t) => !/requests/i.test(t.textContent ?? ""))).toBe(true);
  });

  it("uses rpc for member role instead of direct events query", async () => {
    mockUseUserRole.mockReturnValue({ canWrite: false, role: "member", isLoading: false });
    mockRpc.mockResolvedValue({ data: [makeEvent()], error: null });
    renderBookings();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "get_member_bookings",
        expect.objectContaining({ _tenant_id: "tenant-1" }),
      );
    });
  });

  it("shows pagination when there are more than 10 events", async () => {
    const manyEvents = Array.from({ length: 12 }, (_, i) =>
      makeEvent({ id: `evt${i}`, clients: { name: `Client ${i}` } }),
    );
    queryResults.events = { data: manyEvents, error: null };
    renderBookings();
    await screen.findAllByText("Client 0");

    expect(await screen.findByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("navigates to the next page on pagination click", async () => {
    const manyEvents = Array.from({ length: 12 }, (_, i) =>
      makeEvent({ id: `evt${i}`, clients: { name: `Client ${i}` } }),
    );
    queryResults.events = { data: manyEvents, error: null };
    renderBookings();
    await screen.findAllByText("Client 0");

    fireEvent.click(await screen.findByRole("button", { name: /next/i }));
    expect(await screen.findByText(/page 2 of 2/i)).toBeInTheDocument();
  });

  it("resets to page 1 when a filter changes", async () => {
    const manyEvents = Array.from({ length: 12 }, (_, i) =>
      makeEvent({ id: `evt${i}`, payment_status: "unpaid", clients: { name: `Client ${i}` } }),
    );
    queryResults.events = { data: manyEvents, error: null };
    renderBookings();
    await screen.findAllByText("Client 0");

    fireEvent.click(await screen.findByRole("button", { name: /next/i }));
    expect(await screen.findByText(/page 2 of 2/i)).toBeInTheDocument();

    // Changing filter resets page
    fireEvent.click(screen.getByRole("button", { name: /^paid$/i }));
    await waitFor(() => expect(screen.queryByText(/page 2/i)).not.toBeInTheDocument());
  });
});
