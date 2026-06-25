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

import { useTenantId } from "./useTenantId";

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTenantId(), { wrapper });
}

beforeEach(() => {
  mockRpc.mockReset();
  mockUseAuth.mockReset();
  localStorage.clear();
  window.history.replaceState({}, "", "/app");
  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("useTenantId", () => {
  it("resolves to the primary tenant when the user belongs to only one workspace", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_user_tenant_id") return Promise.resolve({ data: "tenant-primary", error: null });
      if (fn === "get_user_tenants") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderWithQueryClient();
    await waitFor(() => expect(result.current.tenantId).toBe("tenant-primary"));
  });

  it("prefers the locally active tenant when the user belongs to multiple workspaces", async () => {
    localStorage.setItem("simchasync_active_tenant", "tenant-b");
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_user_tenant_id") return Promise.resolve({ data: "tenant-a", error: null });
      if (fn === "get_user_tenants") {
        return Promise.resolve({
          data: [{ tenant_id: "tenant-a" }, { tenant_id: "tenant-b" }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderWithQueryClient();
    await waitFor(() => expect(result.current.tenantId).toBe("tenant-b"));
  });

  it("falls back to the first workspace when the stored active tenant is no longer valid", async () => {
    localStorage.setItem("simchasync_active_tenant", "tenant-stale");
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_user_tenant_id") return Promise.resolve({ data: "tenant-a", error: null });
      if (fn === "get_user_tenants") {
        return Promise.resolve({
          data: [{ tenant_id: "tenant-a" }, { tenant_id: "tenant-b" }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderWithQueryClient();
    await waitFor(() => expect(result.current.tenantId).toBe("tenant-a"));
  });

  it("does not query for a tenant when there is no authenticated user", () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderWithQueryClient();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
