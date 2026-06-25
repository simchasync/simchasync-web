import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { en } from "@/i18n/en";

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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/components/invoices/InvoicePreview", () => ({
  default: ({ invoice }: { invoice: { id: string } }) => <div data-testid="invoice-preview">{invoice.id}</div>,
}));
vi.mock("@/components/invoices/SendInvoiceDialog", () => ({
  default: ({ invoice }: { invoice: { id: string } }) => <div data-testid="send-invoice-dialog">{invoice.id}</div>,
}));
vi.mock("@/components/invoices/RecordPaymentDialog", () => ({
  default: ({ invoice }: { invoice: { id: string } }) => <div data-testid="record-payment-dialog">{invoice.id}</div>,
}));
vi.mock("@/components/invoices/EditInvoiceDialog", () => ({
  default: ({ invoice }: { invoice: { id: string } }) => <div data-testid="edit-invoice-dialog">{invoice.id}</div>,
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  invoices: { data: [], error: null },
  clients: { data: [], error: null },
  events: { data: [], error: null },
  tenants: { data: { stripe_connect_onboarded: false, name: "Acme", payment_instructions: null }, error: null },
  profiles: { data: { full_name: "Sam", avatar_url: null }, error: null },
  event_payments: { data: [], error: null },
};
let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn(() => builder);
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
const mockInvoke = vi.fn();

function buildersForTable(table: string) {
  return builders.filter((b) => (b as unknown as { __table?: string }).__table === table);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  writable: true,
});

import Invoices from "./Invoices";

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv1",
    amount: 500,
    status: "draft",
    description: null,
    sent_at: null,
    stripe_payment_url: null,
    client_id: "c1",
    event_id: null,
    clients: { name: "Jane Doe", email: "jane@example.com", phone: null },
    events: null,
    ...overrides,
  };
}

function renderInvoices() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<Invoices />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  mockInvoke.mockReset();
  builders = [];
  mockToast.mockReset();
  mockUseTenantId.mockReset();
  mockUseUserRole.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockUseUserRole.mockReturnValue({ canWrite: true });
  resolvedByTable.invoices = { data: [], error: null };
  resolvedByTable.clients = { data: [], error: null };
  resolvedByTable.events = { data: [], error: null };
  resolvedByTable.tenants = { data: { stripe_connect_onboarded: false, name: "Acme", payment_instructions: null }, error: null };
  resolvedByTable.profiles = { data: { full_name: "Sam", avatar_url: null }, error: null };
  resolvedByTable.event_payments = { data: [], error: null };
});

describe("Invoices", () => {
  it("shows the empty state when there are no invoices", async () => {
    renderInvoices();
    expect(await screen.findByText("No data yet")).toBeInTheDocument();
  });

  it("lists invoices, shows stats, and filters by status", async () => {
    resolvedByTable.invoices = {
      data: [makeInvoice({ status: "paid", amount: 100 }), makeInvoice({ id: "inv2", status: "draft", amount: 200 })],
      error: null,
    };
    renderInvoices();

    const beforeFilterCount = (await screen.findAllByText("Jane Doe")).length;
    expect(beforeFilterCount).toBeGreaterThan(0);
    expect(screen.getAllByText("Total Invoiced").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Paid/i }));
    expect(screen.getAllByText("Jane Doe").length).toBeLessThan(beforeFilterCount);
    expect(screen.getAllByText("$100").length).toBeGreaterThan(0);
  });

  it("hides New Invoice and write controls for a non-write role", async () => {
    mockUseUserRole.mockReturnValue({ canWrite: false });
    resolvedByTable.invoices = { data: [makeInvoice()], error: null };
    renderInvoices();
    await screen.findAllByText("Jane Doe");

    expect(screen.queryByRole("button", { name: /New Invoice/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Edit/i }).length).toBe(0);
  });

  it("creates a new invoice via the dialog", async () => {
    renderInvoices();
    await screen.findByText("No data yet");

    fireEvent.click(screen.getByRole("button", { name: /New Invoice/i }));
    fireEvent.change(screen.getByLabelText("Amount *"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const builder = buildersForTable("invoices").find((b) => b.insert.mock.calls.length > 0);
      expect(builder?.insert).toHaveBeenCalledWith(expect.objectContaining({ amount: 250, tenant_id: "tenant-1" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invoice created" }));
    });
  });

  it("deletes an invoice after confirming", async () => {
    resolvedByTable.invoices = { data: [makeInvoice()], error: null };
    renderInvoices();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getAllByRole("button", { name: /Delete/i })[0]);
    expect(await screen.findByText("Delete this invoice?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const builder = buildersForTable("invoices").find((b) => b.delete.mock.calls.length > 0);
      expect(builder).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invoice deleted" }));
    });
  });

  it("opens the edit dialog for an existing invoice", async () => {
    resolvedByTable.invoices = { data: [makeInvoice()], error: null };
    renderInvoices();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getAllByRole("button", { name: /Edit/i })[0]);

    expect(await screen.findByTestId("edit-invoice-dialog")).toHaveTextContent("inv1");
  });

  it("opens the invoice preview dialog", async () => {
    resolvedByTable.invoices = { data: [makeInvoice()], error: null };
    renderInvoices();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getAllByRole("button", { name: /Preview/i })[0]);

    expect(await screen.findByTestId("invoice-preview")).toHaveTextContent("inv1");
  });

  it("shows an error toast when generating a payment link without Stripe connected", async () => {
    resolvedByTable.invoices = { data: [makeInvoice()], error: null };
    renderInvoices();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: /Pay Link/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Connect Stripe in Settings first", variant: "destructive" }),
      );
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("copies an existing payment link instead of generating a new one", async () => {
    resolvedByTable.invoices = { data: [makeInvoice({ stripe_payment_url: "https://pay.example.com/abc" })], error: null };
    renderInvoices();
    await screen.findAllByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: /Copy Link/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://pay.example.com/abc");
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Payment link copied!" }));
    });
  });
});
