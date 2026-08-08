import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { en } from "@/i18n/en";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

vi.mock("@/hooks/useRealtimeInvalidate", () => ({
  useRealtimeInvalidate: () => {},
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Default to Premium (unlimited invites) so the invite flow is unrestricted;
// individual tests override to exercise the plan cap.
const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  tenant_members: { data: [], error: null },
  profiles: { data: [], error: null },
  colleagues: { data: [], error: null },
  event_colleagues: { data: [], error: null },
};
let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
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
const mockRpc = vi.fn();

function buildersForTable(table: string) {
  return builders.filter((b) => (b as unknown as { __table?: string }).__table === table);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import Team from "./Team";

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    role: "booking_manager",
    user_id: "user-2",
    created_at: "2026-01-01T00:00:00Z",
    invitation_status: "accepted",
    invitation_email: null,
    invited_at: null,
    accepted_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return { user_id: "user-2", full_name: "Bob Booking", email: "bob@example.com", avatar_url: null, ...overrides };
}

function makeColleague(overrides: Record<string, unknown> = {}) {
  return {
    id: "col1",
    full_name: "DJ Sam",
    role_instrument: "DJ",
    phone: null,
    email: "sam@example.com",
    notes: null,
    default_price: 0,
    ...overrides,
  };
}

function renderTeam() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<Team />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  mockInvoke.mockReset();
  mockRpc.mockReset();
  builders = [];
  mockToast.mockReset();
  mockUseTenantId.mockReset();
  mockNavigate.mockReset();
  mockUseSubscription.mockReset();
  mockUseSubscription.mockReturnValue({ tier: "premium", plan: "premium", trialActive: false });

  mockUseTenantId.mockReturnValue({
    tenantId: "tenant-1",
    userTenants: [{ tenant_id: "tenant-1" }],
    switchTenant: vi.fn(),
  });
  resolvedByTable.tenant_members = { data: [], error: null };
  resolvedByTable.profiles = { data: [], error: null };
  resolvedByTable.colleagues = { data: [], error: null };
  resolvedByTable.event_colleagues = { data: [], error: null };

  const originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, href: "" },
  });
});

describe("Team", () => {
  it("shows the empty teammates state when there are no members", async () => {
    renderTeam();
    expect(await screen.findByText("No teammates yet.")).toBeInTheDocument();
  });

  it("lists teammates with stats and role badges (owner view)", async () => {
    resolvedByTable.tenant_members = {
      data: [makeMember({ id: "owner1", role: "owner", user_id: "user-1" }), makeMember()],
      error: null,
    };
    resolvedByTable.profiles = { data: [makeProfile()], error: null };
    renderTeam();

    expect(await screen.findByText("Bob Booking")).toBeInTheDocument();
    expect(screen.getAllByText("Teammates").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Booking Manager").length).toBeGreaterThan(0);
  });

  it("invites a new teammate", async () => {
    resolvedByTable.tenant_members = { data: [makeMember({ id: "owner1", role: "owner", user_id: "user-1" })], error: null };
    mockInvoke.mockResolvedValue({ data: { invited: true }, error: null });
    renderTeam();
    await screen.findByRole("button", { name: /Invite Member/i });

    fireEvent.click(screen.getByRole("button", { name: /Invite Member/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Invite Member/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "invite-team-member",
        expect.objectContaining({ body: expect.objectContaining({ email: "new@example.com", tenant_id: "tenant-1" }) }),
      );
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invitation sent!" }));
    });
  });

  it("removes a teammate (owner action)", async () => {
    resolvedByTable.tenant_members = {
      data: [makeMember({ id: "owner1", role: "owner", user_id: "user-1" }), makeMember()],
      error: null,
    };
    resolvedByTable.profiles = { data: [makeProfile()], error: null };
    renderTeam();
    await screen.findByText("Bob Booking");

    fireEvent.click(screen.getByRole("button", { name: /Remove/i }));

    await waitFor(() => {
      const builder = buildersForTable("tenant_members").find((b) => b.delete.mock.calls.length > 0);
      expect(builder).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Member removed" }));
    });
  });

  it("lets a non-owner leave the workspace", async () => {
    resolvedByTable.tenant_members = { data: [makeMember({ user_id: "user-1" })], error: null };
    mockRpc.mockResolvedValue({ data: null, error: null });
    renderTeam();
    await screen.findByRole("button", { name: /Leave Workspace/i });

    fireEvent.click(screen.getByRole("button", { name: /Leave Workspace/i }));
    fireEvent.click(screen.getByRole("button", { name: /Leave Workspace/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("leave_workspace", { _tenant_id: "tenant-1" });
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Left workspace" }));
    });
  });

  it("switches to the Colleagues tab and shows the empty state", async () => {
    renderTeam();
    await screen.findByText("No teammates yet.");

    const colleaguesTab = screen.getByRole("tab", { name: /Colleagues/i });
    fireEvent.mouseDown(colleaguesTab);
    colleaguesTab.focus();
    fireEvent.focus(colleaguesTab);
    fireEvent.click(colleaguesTab);

    expect(await screen.findByText("No colleagues found.")).toBeInTheDocument();
  });

  it("adds a new colleague", async () => {
    resolvedByTable.tenant_members = { data: [makeMember({ id: "owner1", role: "owner", user_id: "user-1" })], error: null };
    renderTeam();
    await screen.findByRole("tab", { name: /Colleagues/i });

    const colleaguesTab = screen.getByRole("tab", { name: /Colleagues/i });
    fireEvent.mouseDown(colleaguesTab);
    colleaguesTab.focus();
    fireEvent.focus(colleaguesTab);
    fireEvent.click(colleaguesTab);
    await screen.findByText("No colleagues found.");

    fireEvent.click(screen.getByRole("button", { name: /Add Colleague/i }));
    fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "New DJ" } });
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "newdj@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Colleague" }));

    await waitFor(() => {
      const builder = buildersForTable("colleagues").find((b) => b.insert.mock.calls.length > 0);
      expect(builder?.insert).toHaveBeenCalledWith(expect.objectContaining({ full_name: "New DJ", tenant_id: "tenant-1" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Colleague added" }));
    });
  });

  it("edits an existing colleague, pre-filling the form", async () => {
    resolvedByTable.tenant_members = { data: [makeMember({ id: "owner1", role: "owner", user_id: "user-1" })], error: null };
    resolvedByTable.colleagues = { data: [makeColleague()], error: null };
    renderTeam();
    await screen.findByRole("tab", { name: /Colleagues/i });

    const colleaguesTab = screen.getByRole("tab", { name: /Colleagues/i });
    fireEvent.mouseDown(colleaguesTab);
    colleaguesTab.focus();
    fireEvent.focus(colleaguesTab);
    fireEvent.click(colleaguesTab);
    await screen.findByText("DJ Sam");

    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    expect(screen.getByLabelText("Full Name *")).toHaveValue("DJ Sam");

    fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "DJ Sam Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const builder = buildersForTable("colleagues").find((b) => b.update.mock.calls.length > 0);
      expect(builder?.update).toHaveBeenCalledWith(expect.objectContaining({ full_name: "DJ Sam Updated" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Colleague updated" }));
    });
  });

  it("deletes a colleague", async () => {
    resolvedByTable.tenant_members = { data: [makeMember({ id: "owner1", role: "owner", user_id: "user-1" })], error: null };
    resolvedByTable.colleagues = { data: [makeColleague()], error: null };
    renderTeam();
    await screen.findByRole("tab", { name: /Colleagues/i });

    const colleaguesTab = screen.getByRole("tab", { name: /Colleagues/i });
    fireEvent.mouseDown(colleaguesTab);
    colleaguesTab.focus();
    fireEvent.focus(colleaguesTab);
    fireEvent.click(colleaguesTab);
    await screen.findByText("DJ Sam");

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));

    await waitFor(() => {
      const builder = buildersForTable("colleagues").find((b) => b.delete.mock.calls.length > 0);
      expect(builder).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Colleague removed" }));
    });
  });
});
