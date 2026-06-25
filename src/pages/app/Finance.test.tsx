import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/components/finance/FinancialReportPrint", () => ({
  default: () => null,
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  events: { data: [], error: null },
  workspace_expenses: { data: [], error: null },
  event_expenses: { data: [], error: null },
  booking_agents: { data: [], error: null },
  event_colleagues: { data: [], error: null },
  tenant_landing_pages: { data: null, error: null },
};
let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedByTable[table]).then(resolve, reject);
  return Object.assign(builder, { __table: table }) as Builder;
}

const mockFrom = vi.fn((table: string) => {
  const builder = makeBuilder(table);
  builders.push(builder);
  return builder;
});

function buildersForTable(table: string) {
  return builders.filter((b) => (b as unknown as { __table?: string }).__table === table);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
  },
}));

import Finance from "./Finance";

function makeEvent(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-10`;
  return {
    id: "e1",
    event_date: thisMonth,
    event_type: "wedding",
    total_price: 1000,
    travel_fee: 0,
    travel_fee_type: "none",
    payment_status: "paid",
    deposit: 0,
    clients: { name: "Jane Doe" },
    ...overrides,
  };
}

function renderFinance() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<Finance />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  builders = [];
  mockToast.mockReset();
  mockUseTenantId.mockReset();
  mockUseSubscription.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1", userTenants: [{ tenant_id: "tenant-1", tenant_name: "Acme" }] });
  mockUseSubscription.mockReturnValue({ canAccess: () => true, loading: false });

  resolvedByTable.events = { data: [], error: null };
  resolvedByTable.workspace_expenses = { data: [], error: null };
  resolvedByTable.event_expenses = { data: [], error: null };
  resolvedByTable.booking_agents = { data: [], error: null };
  resolvedByTable.event_colleagues = { data: [], error: null };
  resolvedByTable.tenant_landing_pages = { data: null, error: null };
});

describe("Finance", () => {
  it("shows the Pro upsell when expenses_profit access is denied", async () => {
    mockUseSubscription.mockReturnValue({ canAccess: () => false, loading: false });
    renderFinance();
    expect(await screen.findByText("Financial Reports is a Pro feature")).toBeInTheDocument();
    expect(screen.queryByText("Total Revenue")).not.toBeInTheDocument();
  });

  it("shows stat cards and the P&L summary for this month's bookings", async () => {
    resolvedByTable.events = { data: [makeEvent()], error: null };
    renderFinance();

    expect(await screen.findByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getAllByText("$1,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Net Profit").length).toBeGreaterThan(0);
  });

  it("shows empty states across tabs when there is no data", async () => {
    renderFinance();
    await screen.findByText("Total Revenue");

    const expensesTab = screen.getByRole("tab", { name: "Expenses" });
    fireEvent.mouseDown(expensesTab);
    expensesTab.focus();
    fireEvent.focus(expensesTab);
    fireEvent.click(expensesTab);

    expect(await screen.findByText(/No general expenses for this period/)).toBeInTheDocument();
  });

  it("switches to the Income tab and shows booking income", async () => {
    resolvedByTable.events = { data: [makeEvent()], error: null };
    renderFinance();
    await screen.findByText("Total Revenue");

    const incomeTab = screen.getByRole("tab", { name: "Income" });
    fireEvent.mouseDown(incomeTab);
    incomeTab.focus();
    fireEvent.focus(incomeTab);
    fireEvent.click(incomeTab);

    expect(await screen.findByText("Booking Income")).toBeInTheDocument();
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
  });

  it("switches to the Commissions tab and shows the agent breakdown", async () => {
    resolvedByTable.booking_agents = {
      data: [{
        commission_amount: 100, commission_rate: 10, commission_paid: true, agent_id: "a1",
        agents: { name: "Sam Agent" },
        events: { event_date: new Date().toISOString().slice(0, 10), event_type: "wedding", clients: { name: "Jane Doe" } },
      }],
      error: null,
    };
    renderFinance();
    await screen.findByText("Total Revenue");

    const commissionsTab = screen.getByRole("tab", { name: "Commissions" });
    fireEvent.mouseDown(commissionsTab);
    commissionsTab.focus();
    fireEvent.focus(commissionsTab);
    fireEvent.click(commissionsTab);

    expect(await screen.findByText("Sam Agent")).toBeInTheDocument();
  });

  it("adds a new general expense", async () => {
    renderFinance();
    await screen.findByText("Total Revenue");

    const expensesTab = screen.getByRole("tab", { name: "Expenses" });
    fireEvent.mouseDown(expensesTab);
    expensesTab.focus();
    fireEvent.focus(expensesTab);
    fireEvent.click(expensesTab);
    await screen.findByText(/No general expenses for this period/);

    fireEvent.click(screen.getByRole("button", { name: /Add Expense/i }));
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Office rent" } });
    fireEvent.change(screen.getByLabelText("Amount ($) *"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    await waitFor(() => {
      const builder = buildersForTable("workspace_expenses").find((b) => b.insert.mock.calls.length > 0);
      expect(builder?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Office rent", amount: 250, tenant_id: "tenant-1" }),
      );
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Expense added" }));
    });
  });

  it("edits an existing expense, pre-filling the form", async () => {
    resolvedByTable.workspace_expenses = {
      data: [{ id: "exp1", title: "Office rent", amount: 250, category: "rent", expense_date: "2026-06-01", notes: null }],
      error: null,
    };
    renderFinance();
    await screen.findByText("Total Revenue");

    const expensesTab = screen.getByRole("tab", { name: "Expenses" });
    fireEvent.mouseDown(expensesTab);
    expensesTab.focus();
    fireEvent.focus(expensesTab);
    fireEvent.click(expensesTab);
    await screen.findByText("Office rent");

    fireEvent.click(screen.getAllByRole("button").find((b) => b.querySelector(".lucide-pencil"))!);
    expect(screen.getByLabelText("Title *")).toHaveValue("Office rent");

    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Office rent updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Expense" }));

    await waitFor(() => {
      const builder = buildersForTable("workspace_expenses").find((b) => b.update.mock.calls.length > 0);
      expect(builder?.update).toHaveBeenCalledWith(expect.objectContaining({ title: "Office rent updated" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Expense updated" }));
    });
  });

  it("deletes an expense", async () => {
    resolvedByTable.workspace_expenses = {
      data: [{ id: "exp1", title: "Office rent", amount: 250, category: "rent", expense_date: "2026-06-01", notes: null }],
      error: null,
    };
    renderFinance();
    await screen.findByText("Total Revenue");

    const expensesTab = screen.getByRole("tab", { name: "Expenses" });
    fireEvent.mouseDown(expensesTab);
    expensesTab.focus();
    fireEvent.focus(expensesTab);
    fireEvent.click(expensesTab);
    await screen.findByText("Office rent");

    fireEvent.click(screen.getAllByRole("button").find((b) => b.querySelector(".lucide-trash2"))!);

    await waitFor(() => {
      const builder = buildersForTable("workspace_expenses").find((b) => b.delete.mock.calls.length > 0);
      expect(builder).toBeTruthy();
    });
  });

  it("shows custom date inputs when the Custom Range preset is chosen", async () => {
    renderFinance();
    await screen.findByText("Total Revenue");

    const periodSelect = screen.getByRole("combobox");
    fireEvent.pointerDown(periodSelect, { button: 0, ctrlKey: false });
    fireEvent.click(periodSelect);
    const option = await screen.findByText("Custom Range");
    fireEvent.click(option);

    expect(await screen.findByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });
});
