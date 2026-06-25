import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

import { useUserRole } from "./useUserRole";

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUserRole(), { wrapper });
}

beforeEach(() => {
  mockRpc.mockReset();
  mockUseAuth.mockReset();
  mockUseTenantId.mockReset();
  mockUseSubscription.mockReset();

  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockUseSubscription.mockReturnValue({ trialExpired: false, subscribed: false, loading: false });
});

describe("useUserRole", () => {
  it("grants write access to an owner whose trial hasn't expired", async () => {
    mockRpc.mockResolvedValue({ data: "owner", error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.role).toBe("owner"));

    expect(result.current.isOwner).toBe(true);
    expect(result.current.isSocialOnly).toBe(false);
    expect(result.current.canWrite).toBe(true);
  });

  it("grants write access to a booking_manager", async () => {
    mockRpc.mockResolvedValue({ data: "booking_manager", error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.role).toBe("booking_manager"));
    expect(result.current.canWrite).toBe(true);
  });

  it("denies write access to a social_media_manager regardless of subscription", async () => {
    mockRpc.mockResolvedValue({ data: "social_media_manager", error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.role).toBe("social_media_manager"));
    expect(result.current.isSocialOnly).toBe(true);
    expect(result.current.canWrite).toBe(false);
  });

  it("denies write access to an owner once the trial has expired and they aren't subscribed", async () => {
    mockUseSubscription.mockReturnValue({ trialExpired: true, subscribed: false, loading: false });
    mockRpc.mockResolvedValue({ data: "owner", error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.role).toBe("owner"));
    expect(result.current.canWrite).toBe(false);
  });

  it("still allows an expired-trial owner to write if they're subscribed", async () => {
    mockUseSubscription.mockReturnValue({ trialExpired: true, subscribed: true, loading: false });
    mockRpc.mockResolvedValue({ data: "owner", error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.role).toBe("owner"));
    expect(result.current.canWrite).toBe(true);
  });

  it("does not query when there is no tenantId yet", () => {
    mockUseTenantId.mockReturnValue({ tenantId: null });
    renderWithQueryClient();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
