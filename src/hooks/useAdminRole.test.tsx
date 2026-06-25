import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockEq = vi.fn();
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((..._args: unknown[]) => ({ select: mockSelect }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { useAdminRole } from "./useAdminRole";

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAdminRole(), { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockEq.mockReset();
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("useAdminRole", () => {
  it("grants full access to an admin", async () => {
    mockEq.mockResolvedValue({ data: [{ role: "admin" }], error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    expect(result.current.hasAnyAdminRole).toBe(true);
    expect(result.current.canManageBilling).toBe(true);
    expect(result.current.canResetPasswords).toBe(true);
    expect(result.current.canInviteTenants).toBe(true);
    expect(result.current.canManageAdmins).toBe(true);
  });

  it("grants only billing access to a billing_admin", async () => {
    mockEq.mockResolvedValue({ data: [{ role: "billing_admin" }], error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.isBillingAdmin).toBe(true));

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.canManageBilling).toBe(true);
    expect(result.current.canResetPasswords).toBe(false);
    expect(result.current.canInviteTenants).toBe(false);
    expect(result.current.canManageAdmins).toBe(false);
  });

  it("grants only password-reset access to a support_agent", async () => {
    mockEq.mockResolvedValue({ data: [{ role: "support_agent" }], error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.isSupportAgent).toBe(true));

    expect(result.current.canManageBilling).toBe(false);
    expect(result.current.canResetPasswords).toBe(true);
    expect(result.current.hasAnyAdminRole).toBe(true);
  });

  it("denies all admin access to a plain member", async () => {
    mockEq.mockResolvedValue({ data: [{ role: "member" }], error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.roles).toEqual(["member"]));

    expect(result.current.hasAnyAdminRole).toBe(false);
    expect(result.current.canManageBilling).toBe(false);
    expect(result.current.canResetPasswords).toBe(false);
  });

  it("defaults to an empty role list with no admin access while loading or with no user", () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderWithQueryClient();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.roles).toEqual([]);
    expect(result.current.hasAnyAdminRole).toBe(false);
  });
});
