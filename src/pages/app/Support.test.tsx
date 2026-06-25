import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const en = { app: { support: {} } };
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  support_tickets: { data: [], error: null },
  feature_requests: { data: [], error: null },
  ticket_replies: { data: [], error: null },
};
let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedByTable[table]).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn((table: string) => {
  const builder = makeBuilder(table);
  builders.push(builder);
  return builder;
});

function builderThatCalledInsert() {
  return builders.find((b) => b.insert.mock.calls.length > 0);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [string])) },
}));

import Support from "./Support";

function switchToFeaturesTab() {
  const tab = screen.getByText("Feature Requests");
  fireEvent.mouseDown(tab);
  tab.focus();
  fireEvent.focus(tab);
  fireEvent.click(tab);
}

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    subject: "Cannot log in",
    description: "I get an error.",
    status: "open",
    priority: "high",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderSupport() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<Support />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  builders = [];
  mockToast.mockReset();
  mockUseAuth.mockReset();
  mockUseTenantId.mockReset();

  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  resolvedByTable.support_tickets = { data: [], error: null };
  resolvedByTable.feature_requests = { data: [], error: null };
  resolvedByTable.ticket_replies = { data: [], error: null };
});

describe("Support", () => {
  it("shows the empty state when there are no tickets", async () => {
    renderSupport();
    expect(await screen.findByText("No support tickets yet")).toBeInTheDocument();
  });

  it("lists a ticket with its status and priority badges", async () => {
    resolvedByTable.support_tickets = { data: [makeTicket()], error: null };
    renderSupport();
    expect(await screen.findByText("Cannot log in")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("creates a new ticket and shows a success toast", async () => {
    resolvedByTable.support_tickets = { data: [], error: null };
    renderSupport();
    await screen.findByText("No support tickets yet");

    fireEvent.click(screen.getByRole("button", { name: /New Ticket/i }));
    fireEvent.change(screen.getByPlaceholderText("Subject"), { target: { value: "Billing issue" } });
    fireEvent.change(screen.getByPlaceholderText("Describe your issue..."), { target: { value: "Charged twice" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit Ticket/i }));

    await waitFor(() => {
      const builder = builderThatCalledInsert();
      expect(builder?.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: "tenant-1",
          user_id: "user-1",
          subject: "Billing issue",
          description: "Charged twice",
          priority: "medium",
        })
      );
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Ticket created" }));
    });
  });

  it("opens a ticket and shows its replies, then sends a new reply", async () => {
    resolvedByTable.support_tickets = { data: [makeTicket()], error: null };
    resolvedByTable.ticket_replies = {
      data: [{ id: "r1", message: "We're looking into it.", is_admin: true, created_at: "2026-01-02T00:00:00Z" }],
      error: null,
    };
    renderSupport();
    fireEvent.click(await screen.findByText("Cannot log in"));

    expect(await screen.findByText("We're looking into it.")).toBeInTheDocument();
    expect(screen.getByText("I get an error.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type your reply..."), { target: { value: "Any update?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      const builder = builderThatCalledInsert();
      expect(builder?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ ticket_id: "t1", user_id: "user-1", message: "Any update?" })
      );
    });
  });

  it("switches to the Feature Requests tab and shows its empty state", async () => {
    renderSupport();
    await screen.findByText("No support tickets yet");

    switchToFeaturesTab();

    expect(await screen.findByText(/Be the first to suggest one/i)).toBeInTheDocument();
  });

  it("submits a feature request", async () => {
    renderSupport();
    await screen.findByText("No support tickets yet");
    switchToFeaturesTab();
    await screen.findByText(/Be the first to suggest one/i);

    fireEvent.click(screen.getByRole("button", { name: /Request a Feature/i }));
    fireEvent.change(screen.getByPlaceholderText("Feature title"), { target: { value: "Dark mode for invoices" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    await waitFor(() => {
      const builder = builderThatCalledInsert();
      expect(builder?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: "tenant-1", user_id: "user-1", title: "Dark mode for invoices" })
      );
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Feature request submitted!" }));
    });
  });

  it("lists a feature request with admin notes when present", async () => {
    resolvedByTable.feature_requests = {
      data: [{ id: "f1", title: "Export to CSV", description: "Would help a lot", status: "planned", admin_notes: "On our roadmap", created_at: "2026-01-01T00:00:00Z" }],
      error: null,
    };
    renderSupport();
    await screen.findByText("No support tickets yet");
    switchToFeaturesTab();

    expect(await screen.findByText("Export to CSV")).toBeInTheDocument();
    expect(screen.getByText("On our roadmap")).toBeInTheDocument();
    expect(screen.getByText("planned")).toBeInTheDocument();
  });
});
