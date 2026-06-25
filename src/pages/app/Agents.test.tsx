import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

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

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  agents: { data: [], error: null },
  booking_agents: { data: [], error: null },
};
let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedByTable[table]).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn((table: string) => {
  const builder = makeBuilder(table);
  builders.push(builder);
  return builder;
});

function builderThatCalled(method: "insert" | "update" | "delete") {
  return builders.find((b) => b[method].mock.calls.length > 0);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [string])) },
}));

import Agents from "./Agents";

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    name: "Sam Agent",
    email: "sam@example.com",
    phone: null,
    commission_rate: 10,
    notes: null,
    ...overrides,
  };
}

function renderAgents() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<Agents />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  builders = [];
  mockToast.mockReset();
  mockUseTenantId.mockReset();
  mockUseUserRole.mockReset();
  mockUseSubscription.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockUseUserRole.mockReturnValue({ isOwner: true });
  mockUseSubscription.mockReturnValue({ canAccess: () => true, loading: false });
  resolvedByTable.agents = { data: [], error: null };
  resolvedByTable.booking_agents = { data: [], error: null };
});

describe("Agents", () => {
  it("shows the Pro upsell when expenses_profit access is denied", async () => {
    mockUseSubscription.mockReturnValue({ canAccess: () => false, loading: false });
    renderAgents();
    expect(await screen.findByText("Agents & Commissions is a Pro feature")).toBeInTheDocument();
    expect(screen.queryByText("Agents & Commissions")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no agents", async () => {
    renderAgents();
    expect(await screen.findByText(/No agents yet/i)).toBeInTheDocument();
  });

  it("shows agent summary stats and the agent's commission rate", async () => {
    resolvedByTable.agents = { data: [makeAgent({ commission_rate: 15 })], error: null };
    resolvedByTable.booking_agents = {
      data: [
        {
          id: "ba1",
          agent_id: "a1",
          commission_amount: 100,
          commission_paid: true,
          commission_rate: 15,
          events: { event_type: "wedding", event_date: "2026-05-01", clients: { name: "Client A" } },
        },
        {
          id: "ba2",
          agent_id: "a1",
          commission_amount: 50,
          commission_paid: false,
          commission_rate: 15,
          events: { event_type: "bar_mitzvah", event_date: "2026-06-01", clients: { name: "Client B" } },
        },
      ],
      error: null,
    };
    renderAgents();

    expect((await screen.findAllByText("$150.00")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$50.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15%").length).toBeGreaterThan(0);
  });

  it("hides Add Agent and edit/delete controls for a non-owner", async () => {
    mockUseUserRole.mockReturnValue({ isOwner: false });
    resolvedByTable.agents = { data: [makeAgent()], error: null };
    renderAgents();
    await screen.findAllByText("Sam Agent");

    expect(screen.queryByRole("button", { name: /Add Agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
  });

  it("adds a new agent via the dialog", async () => {
    renderAgents();
    await screen.findByText(/No agents yet/i);

    fireEvent.click(screen.getByRole("button", { name: /Add Agent/i }));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "New Agent" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const builder = builderThatCalled("insert");
      expect(builder?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Agent", tenant_id: "tenant-1", commission_rate: 10 })
      );
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Agent added" }));
    });
  });

  it("edits an existing agent, pre-filling the form", async () => {
    resolvedByTable.agents = { data: [makeAgent()], error: null };
    renderAgents();
    await screen.findAllByText("Sam Agent");

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByLabelText("Name *")).toHaveValue("Sam Agent");

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Sam Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const builder = builderThatCalled("update");
      expect(builder?.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Sam Updated" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Agent updated" }));
    });
  });

  it("deletes an agent", async () => {
    resolvedByTable.agents = { data: [makeAgent()], error: null };
    renderAgents();
    await screen.findAllByText("Sam Agent");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => {
      const builder = builderThatCalled("delete");
      expect(builder).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Agent deleted" }));
    });
  });

  it("expands an agent's bookings and toggles a commission's paid status", async () => {
    resolvedByTable.agents = { data: [makeAgent()], error: null };
    resolvedByTable.booking_agents = {
      data: [
        {
          id: "ba1",
          agent_id: "a1",
          commission_amount: 100,
          commission_paid: false,
          commission_rate: 10,
          events: { event_type: "wedding", event_date: "2026-05-01", clients: { name: "Client A" } },
        },
      ],
      error: null,
    };
    renderAgents();
    await screen.findAllByText("Sam Agent");

    fireEvent.click(screen.getAllByText(/1 booking/i)[0]);
    const pendingButtons = await screen.findAllByRole("button", { name: /Pending|Mark Paid/i });
    fireEvent.click(pendingButtons[0]);

    await waitFor(() => {
      const builder = builderThatCalled("update");
      expect(builder?.update).toHaveBeenCalledWith({ commission_paid: true });
    });
  });
});
