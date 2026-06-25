import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const en = {
  app: {
    bookings: {
      noRequests: "No booking requests yet",
      eventType: "Event Type",
      date: "Sort by Date",
      status: "Status",
      markContacted: "Mark Contacted",
      requestStatuses: { new: "New", contacted: "Contacted", booked: "Booked", declined: "Declined" },
      types: { wedding: "Wedding", bar_mitzvah: "Bar Mitzvah" },
    },
    clients: { name: "Name", email: "Email", phone: "Phone" },
  },
};
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

vi.mock("@/hooks/useRealtimeInvalidate", () => ({
  useRealtimeInvalidate: () => {},
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

let resolvedValue: unknown = { data: [], error: null };
let builders: Builder[] = [];

function makeBuilder(): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn((..._args: unknown[]) => {
  const builder = makeBuilder();
  builders.push(builder);
  return builder;
});

function builderThatCalled(method: "update" | "insert") {
  return builders.find((b) => b[method].mock.calls.length > 0);
}

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockGetOrCreateClient = vi.fn();
vi.mock("@/lib/clientDedup", () => ({
  getOrCreateClient: (...args: unknown[]) => mockGetOrCreateClient(...args),
}));

import BookingRequests, { useBookingRequestCount } from "./BookingRequests";
import { renderHook } from "@testing-library/react";

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "555-1234",
    event_type: "wedding",
    event_date: "2026-08-01",
    status: "new",
    message: null,
    source_event_id: null,
    price: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderRequests() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<BookingRequests />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  builders = [];
  mockInvoke.mockReset();
  mockToast.mockReset();
  mockGetOrCreateClient.mockReset();
  mockUseTenantId.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockInvoke.mockResolvedValue({ data: {}, error: null });
  mockGetOrCreateClient.mockResolvedValue({ client: { id: "client-1" } });
  resolvedValue = { data: [], error: null };
});

describe("BookingRequests", () => {
  it("shows the empty state when there are no requests", async () => {
    renderRequests();
    expect(await screen.findByText("No booking requests yet")).toBeInTheDocument();
  });

  it("hides requests that are booked/declined and already converted to an event", async () => {
    resolvedValue = {
      data: [makeRequest({ status: "booked", source_event_id: "ev-1" })],
      error: null,
    };
    renderRequests();
    expect(await screen.findByText("No booking requests yet")).toBeInTheDocument();
  });

  it("lists a request with its status badge and event type label", async () => {
    resolvedValue = { data: [makeRequest()], error: null };
    renderRequests();
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Wedding")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("marks a new request as contacted", async () => {
    resolvedValue = { data: [makeRequest({ status: "new" })], error: null };
    renderRequests();
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: /Mark Contacted/i }));

    await waitFor(() => {
      const builder = builderThatCalled("update");
      expect(builder).toBeTruthy();
    });
  });

  it("accepts a request: creates/looks up the client, inserts an event, marks it booked, and emails the client", async () => {
    resolvedValue = { data: [makeRequest({ status: "contacted" })], error: null };
    renderRequests();
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(mockGetOrCreateClient).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "555-1234",
      });
      const insertBuilder = builderThatCalled("insert");
      expect(insertBuilder?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: "client-1", tenant_id: "tenant-1" })
      );
      expect(mockInvoke).toHaveBeenCalledWith(
        "send-notification-email",
        expect.objectContaining({ body: expect.objectContaining({ type: "booking_request_accepted" }) })
      );
    });
  });

  it("declines an internal request via declineRequest (update + rejection email)", async () => {
    resolvedValue = { data: [makeRequest({ status: "new" })], error: null };
    renderRequests();
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => {
      const builder = builderThatCalled("update");
      expect(builder?.update).toHaveBeenCalledWith({ status: "declined" });
      expect(mockInvoke).toHaveBeenCalledWith(
        "send-notification-email",
        expect.objectContaining({ body: expect.objectContaining({ type: "booking_request_declined" }) })
      );
    });
  });

  it("declines an external request directly via status update, with no rejection email", async () => {
    resolvedValue = { data: [makeRequest({ status: "new", source_event_id: "ev-2" })], error: null };
    renderRequests();
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => {
      const builder = builderThatCalled("update");
      expect(builder?.update).toHaveBeenCalledWith({ status: "declined" });
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("opens the view dialog for a request with a message and shows its details", async () => {
    resolvedValue = {
      data: [makeRequest({ message: "Looking forward to this!" })],
      error: null,
    };
    renderRequests();
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: /View/i }));

    expect(await screen.findByText("Looking forward to this!")).toBeInTheDocument();
    expect(screen.getByText(/From Jane Doe/)).toBeInTheDocument();
  });
});

describe("useBookingRequestCount", () => {
  function renderCountHook(tenantId: string | null) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return renderHook(() => useBookingRequestCount(tenantId), { wrapper });
  }

  it("returns the count from the query", async () => {
    resolvedValue = { count: 4, error: null };
    const { result } = renderCountHook("tenant-1");
    await waitFor(() => expect(result.current).toBe(4));
  });

  it("does not query when tenantId is null", () => {
    mockFrom.mockClear();
    renderCountHook(null);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
