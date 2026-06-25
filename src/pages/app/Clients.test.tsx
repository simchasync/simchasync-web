import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const clients = {
  title: "Clients",
  newClient: "New Client",
  name: "Name",
  email: "Email",
  phone: "Phone",
  notes: "Notes",
  history: "History",
  addHint: "Add a new client to your workspace",
  editHint: "Update client details",
  confirmDeleteTitle: "Delete this client?",
  confirmDeleteDescription: "This client will be permanently removed. This cannot be undone.",
  subtitle: "Manage your client contacts and history",
  totalClients: "Total Clients",
  newThisMonth: "New This Month",
  missingContact: "Missing Contact Info",
  missingContactSub: "{count} without email or phone",
  searchPlaceholder: "Search by name, email, or phone...",
  resultsCount: "{shown} of {total}",
  noMatches: "No clients match your search",
  noMatchesHint: "Try a different name, email, or phone number",
  clearSearch: "Clear search",
  emptyTitle: "No clients yet",
  emptyHint: "Add your first client to start tracking bookings and history",
  addFirst: "Add Your First Client",
};
const en = {
  app: { clients, dashboard: { overview: "Overview" } },
  common: { save: "Save", cancel: "Cancel", delete: "Delete", deleting: "Deleting…", edit: "Edit", create: "Create", loading: "Loading..." },
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

vi.mock("@/hooks/useRealtimeInvalidate", () => ({
  useRealtimeInvalidate: () => {},
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockGetOrCreateClient = vi.fn();
vi.mock("@/lib/clientDedup", () => ({
  getOrCreateClient: (...args: unknown[]) => mockGetOrCreateClient(...args),
}));

vi.mock("@/components/clients/ClientHistoryDialog", () => ({
  default: ({ clientName }: { clientName: string }) => <div data-testid="history-dialog">{clientName}</div>,
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

let resolvedValue: unknown = { data: [], error: null };
let builders: Builder[] = [];

function makeBuilder(): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn((..._args: unknown[]) => {
  const builder = makeBuilder();
  builders.push(builder);
  return builder;
});

function builderThatCalled(method: "update" | "delete") {
  return builders.find((b) => b[method].mock.calls.length > 0);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import Clients from "./Clients";

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "555-1234",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderClients() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<Clients />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  builders = [];
  mockToast.mockReset();
  mockGetOrCreateClient.mockReset();
  mockUseTenantId.mockReset();
  mockUseUserRole.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockUseUserRole.mockReturnValue({ canWrite: true });
  mockGetOrCreateClient.mockResolvedValue({ client: { id: "new-client-1" }, wasCreated: true });
  resolvedValue = { data: [], error: null };
});

describe("Clients", () => {
  it("shows the empty state when there are no clients", async () => {
    renderClients();
    expect(await screen.findByText("No clients yet")).toBeInTheDocument();
  });

  it("lists clients and shows summary stats", async () => {
    resolvedValue = { data: [makeClient()], error: null };
    renderClients();

    expect((await screen.findAllByText("Jane Doe")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total Clients").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("filters clients by the search box", async () => {
    resolvedValue = {
      data: [makeClient(), makeClient({ id: "c2", name: "Bob Smith", email: "bob@example.com", phone: "555-9999" })],
      error: null,
    };
    renderClients();
    await screen.findAllByText("Jane Doe");

    fireEvent.change(screen.getByPlaceholderText("Search by name, email, or phone..."), { target: { value: "Bob" } });

    expect(screen.queryAllByText("Jane Doe").length).toBe(0);
    expect(screen.getAllByText("Bob Smith").length).toBeGreaterThan(0);
  });

  it("hides Add/Edit/Delete controls for a non-write role", async () => {
    mockUseUserRole.mockReturnValue({ canWrite: false });
    resolvedValue = { data: [makeClient()], error: null };
    renderClients();
    await screen.findAllByText("Jane Doe");

    expect(screen.queryByRole("button", { name: /New Client/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Edit" }).length).toBe(0);
  });

  it("creates a new client via the dialog", async () => {
    renderClients();
    await screen.findByText("No clients yet");

    fireEvent.click(screen.getByRole("button", { name: /Add Your First Client/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "New Person" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockGetOrCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1", name: "New Person" })
      );
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Client created" }));
    });
  });

  it("edits an existing client, pre-filling the form", async () => {
    resolvedValue = { data: [makeClient()], error: null };
    renderClients();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Jane Doe");

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Jane Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const builder = builderThatCalled("update");
      expect(builder?.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Updated" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Client updated" }));
    }, { timeout: 10000 });
  }, 15000);

  it("deletes a client after confirming", async () => {
    resolvedValue = { data: [makeClient()], error: null };
    renderClients();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(await screen.findByText("Delete this client?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const builder = builderThatCalled("delete");
      expect(builder).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Client deleted" }));
    });
  });

  it("opens the client history dialog", async () => {
    resolvedValue = { data: [makeClient()], error: null };
    renderClients();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getAllByRole("button", { name: /History/i })[0]);

    expect(await screen.findByTestId("history-dialog")).toHaveTextContent("Jane Doe");
  });
});
