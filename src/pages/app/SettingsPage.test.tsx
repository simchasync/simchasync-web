import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { en } from "@/i18n/en";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "user@example.com" } }),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockUseGoogleCalendar = vi.fn();
vi.mock("@/hooks/useGoogleCalendar", () => ({
  useGoogleCalendar: () => mockUseGoogleCalendar(),
}));

vi.mock("@/components/billing/CancelSubscriptionDialog", () => ({
  CancelSubscriptionDialog: () => null,
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  profiles: { data: { full_name: "Sam Owner", phone: "", avatar_url: null }, error: null },
  tenants: { data: { id: "tenant-1", name: "Acme", slug: "acme", payment_instructions: "", stripe_connect_onboarded: false, calendar_token: null, is_primary_workspace: false }, error: null },
  tenant_members: { data: { role: "owner" }, error: null },
};
let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedByTable[table]).then(resolve, reject);
  return Object.assign(builder, { __table: table }) as Builder;
}

const mockFrom = vi.fn((table: string) => {
  const builder = makeBuilder(table);
  builders.push(builder);
  return builder;
});
const mockRpc = vi.fn();

function buildersForTable(table: string) {
  return builders.filter((b) => (b as unknown as { __table?: string }).__table === table);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  writable: true,
});

import SettingsPage from "./SettingsPage";

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<SettingsPage />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  mockRpc.mockReset();
  builders = [];
  mockToast.mockReset();
  mockUseTenantId.mockReset();
  mockUseSubscription.mockReset();
  mockUseGoogleCalendar.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1", userTenants: [{ tenant_id: "tenant-1" }], switchTenant: vi.fn() });
  mockUseSubscription.mockReturnValue({
    tier: "full", trialActive: false, trialDaysLeft: 0, subscribed: true, subscriptionEnd: null, canceling: false,
    refreshSubscription: vi.fn(), pollUntilSubscribed: vi.fn().mockResolvedValue(true),
  });
  mockUseGoogleCalendar.mockReturnValue({
    isConnected: false, connection: null, needsReauth: false, connect: vi.fn(), disconnect: vi.fn(),
    syncNow: vi.fn(), isSyncing: false, isDisconnecting: false, isLoading: false,
  });

  resolvedByTable.profiles = { data: { full_name: "Sam Owner", phone: "", avatar_url: null }, error: null };
  resolvedByTable.tenants = {
    data: { id: "tenant-1", name: "Acme", slug: "acme", payment_instructions: "", stripe_connect_onboarded: false, calendar_token: null, is_primary_workspace: false },
    error: null,
  };
  resolvedByTable.tenant_members = { data: { role: "owner" }, error: null };

  const originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, href: "" },
  });
});

describe("SettingsPage", () => {
  it("pre-fills the profile form and saves changes", async () => {
    renderSettings();
    const nameInput = await screen.findByDisplayValue("Sam Owner");

    fireEvent.change(nameInput, { target: { value: "Sam Updated" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

    await waitFor(() => {
      const builder = buildersForTable("profiles").find((b) => b.update.mock.calls.length > 0);
      expect(builder?.update).toHaveBeenCalledWith(expect.objectContaining({ full_name: "Sam Updated" }));
    });
  });

  it("shows the workspace section and saves a new workspace name (owner)", async () => {
    renderSettings();
    const workspaceInput = await screen.findByLabelText("Workspace");
    expect(workspaceInput).toHaveValue("Acme");

    fireEvent.change(workspaceInput, { target: { value: "Acme Renamed" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);

    await waitFor(() => {
      const builder = buildersForTable("tenants").find((b) => b.update.mock.calls.length > 0);
      expect(builder?.update).toHaveBeenCalledWith({ name: "Acme Renamed" });
    });
  });

  it("hides owner-only sections for a non-owner member", async () => {
    resolvedByTable.tenant_members = { data: { role: "booking_manager" }, error: null };
    renderSettings();
    await screen.findByLabelText("Full Name");

    expect(screen.queryByLabelText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Danger Zone")).not.toBeInTheDocument();
  });

  it("shows the Stripe Connect status and connect button", async () => {
    renderSettings();
    expect(await screen.findByText("Not Connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect Stripe/i })).toBeInTheDocument();
  });

  it("shows the connected Google Calendar state with sync and disconnect actions", async () => {
    const syncNow = vi.fn();
    const disconnect = vi.fn();
    mockUseGoogleCalendar.mockReturnValue({
      isConnected: true, connection: { google_email: "sam@gmail.com" }, needsReauth: false,
      connect: vi.fn(), disconnect, syncNow, isSyncing: false, isDisconnecting: false, isLoading: false,
    });
    renderSettings();

    expect(await screen.findByText(/sam@gmail.com/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sync Now/i }));
    expect(syncNow).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Disconnect/i }));
    expect(disconnect).toHaveBeenCalled();
  });

  it("generates and copies the ICS calendar link", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    renderSettings();
    const generateButton = await screen.findByRole("button", { name: /Generate Calendar Link/i });

    fireEvent.click(generateButton);

    await waitFor(() => {
      const builder = buildersForTable("tenants").find((b) => b.update.mock.calls.length > 0 && "calendar_token" in b.update.mock.calls[0][0]);
      expect(builder).toBeTruthy();
    });
  });

  it("copies the public booking link", async () => {
    renderSettings();
    await screen.findByText(/\/book\/acme/);

    const copyButtons = screen.getAllByRole("button").filter((b) => b.querySelector(".lucide-copy"));
    fireEvent.click(copyButtons[copyButtons.length - 1]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/book/acme"));
    });
  });

  it("saves payment instructions", async () => {
    renderSettings();
    const textarea = await screen.findByLabelText("Payment Instructions");

    fireEvent.change(textarea, { target: { value: "Pay by check" } });
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      const builder = buildersForTable("tenants").find((b) => b.update.mock.calls.length > 0 && "payment_instructions" in b.update.mock.calls[0][0]);
      expect(builder?.update).toHaveBeenCalledWith({ payment_instructions: "Pay by check" });
    });
  });

  it("shows the main-workspace notice instead of a delete button when is_primary_workspace", async () => {
    resolvedByTable.tenants = {
      data: { id: "tenant-1", name: "Acme", slug: "acme", payment_instructions: "", stripe_connect_onboarded: false, calendar_token: null, is_primary_workspace: true },
      error: null,
    };
    renderSettings();
    expect(await screen.findByText("The main workspace cannot be deleted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete Workspace/i })).not.toBeInTheDocument();
  });

  it("deletes a non-primary workspace after confirming", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    renderSettings();
    await screen.findByText(/\/book\/acme/);

    fireEvent.click(screen.getByRole("button", { name: /Delete Workspace/i }));
    fireEvent.click(screen.getByRole("button", { name: /Delete Workspace/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("delete_workspace", { _tenant_id: "tenant-1" });
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Workspace deleted" }));
    });
  });
});
