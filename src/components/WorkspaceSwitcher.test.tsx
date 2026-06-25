import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSwitchTenant = vi.fn();
const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args), error: (...args: unknown[]) => mockToastError(...args) },
}));

import WorkspaceSwitcher from "./WorkspaceSwitcher";

const TENANTS = [
  { tenant_id: "t1", tenant_name: "Main Co", role: "owner" },
  { tenant_id: "t2", tenant_name: "Side Co", role: "member" },
];

function openDropdown() {
  const trigger = screen.getByRole("button", { name: /Main Co|Side Co|Workspace/ });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1 });
  fireEvent.click(trigger);
  return trigger;
}

beforeEach(() => {
  mockSwitchTenant.mockReset();
  mockUseTenantId.mockReset();
  mockUseSubscription.mockReset();
  mockUseAuth.mockReset();
  mockRpc.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "t1", userTenants: TENANTS, switchTenant: mockSwitchTenant });
  mockUseSubscription.mockReturnValue({ subscribed: false, trialActive: true, plan: "trial" });
  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("WorkspaceSwitcher", () => {
  it("shows the current workspace name and role", () => {
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Main Co")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("shows a Trial status badge when on trial", () => {
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("• Trial")).toBeInTheDocument();
  });

  it("shows an Active status badge when subscribed", () => {
    mockUseSubscription.mockReturnValue({ subscribed: true, trialActive: false, plan: "pro" });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("• Active")).toBeInTheDocument();
  });

  it("shows an Inactive status badge when the plan is none", () => {
    mockUseSubscription.mockReturnValue({ subscribed: false, trialActive: false, plan: "none" });
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("• Inactive")).toBeInTheDocument();
  });

  it("lists all workspaces with a Main badge on the first one", async () => {
    render(<WorkspaceSwitcher />);
    openDropdown();

    expect(await screen.findByText("Side Co")).toBeInTheDocument();
    const mainCoMatches = await screen.findAllByText("Main Co");
    const mainCoRow = mainCoMatches[mainCoMatches.length - 1].closest('[role="menuitem"]');
    expect(mainCoRow).toHaveTextContent("Main");
  });

  it("switches tenant when a different workspace is clicked", async () => {
    render(<WorkspaceSwitcher />);
    openDropdown();

    fireEvent.click(await screen.findByText("Side Co"));
    expect(mockSwitchTenant).toHaveBeenCalledWith("t2");
  });

  it("does not call switchTenant when clicking the already-current workspace", async () => {
    render(<WorkspaceSwitcher />);
    openDropdown();

    const mainCoItem = await screen.findAllByText("Main Co");
    fireEvent.click(mainCoItem[mainCoItem.length - 1]);
    expect(mockSwitchTenant).not.toHaveBeenCalled();
  });

  it("opens the create-workspace dialog and shows the form once allowed", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    render(<WorkspaceSwitcher />);
    openDropdown();

    fireEvent.click(await screen.findByText("Create Workspace"));

    expect(mockRpc).toHaveBeenCalledWith("can_create_workspace", { _user_id: "user-1" });
    expect(await screen.findByLabelText("Workspace Name")).toBeInTheDocument();
  });

  it("shows the cannot-create message when the permission check fails", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    render(<WorkspaceSwitcher />);
    openDropdown();

    fireEvent.click(await screen.findByText("Create Workspace"));
    expect(await screen.findByText("Cannot create workspace")).toBeInTheDocument();
  });

  it("creates a workspace, switches to it, and shows a success toast", async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockRpc.mockResolvedValueOnce({ data: "new-tenant-id", error: null });
    render(<WorkspaceSwitcher />);
    openDropdown();
    fireEvent.click(await screen.findByText("Create Workspace"));

    const input = await screen.findByLabelText("Workspace Name");
    fireEvent.change(input, { target: { value: "New Workspace" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("create_user_workspace", { _user_id: "user-1", _name: "New Workspace" });
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockSwitchTenant).toHaveBeenCalledWith("new-tenant-id");
    });
  });

  it("shows an error toast when workspace creation fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockRpc.mockRejectedValueOnce(new Error("limit reached"));
    render(<WorkspaceSwitcher />);
    openDropdown();
    fireEvent.click(await screen.findByText("Create Workspace"));

    const input = await screen.findByLabelText("Workspace Name");
    fireEvent.change(input, { target: { value: "New Workspace" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("limit reached"));
  });
});
