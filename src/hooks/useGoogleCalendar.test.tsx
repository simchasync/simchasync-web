import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockRpc = vi.fn();
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { useGoogleCalendar, syncEventToCalendar, calendarConnectionKey } from "./useGoogleCalendar";

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useGoogleCalendar(), { wrapper }), queryClient };
}

beforeEach(() => {
  mockRpc.mockReset();
  mockInvoke.mockReset();
  mockUseTenantId.mockReset();
  mockToast.mockReset();
  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });

  const originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, href: "" },
  });
});

describe("calendarConnectionKey", () => {
  it("builds a query key scoped to the tenant", () => {
    expect(calendarConnectionKey("tenant-1")).toEqual(["calendar-connection", "tenant-1"]);
  });
});

describe("syncEventToCalendar", () => {
  it("invokes gcal-sync with the action, eventId, and tenantId", async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    await syncEventToCalendar("tenant-1", "upsert", "event-1");
    expect(mockInvoke).toHaveBeenCalledWith("gcal-sync", {
      body: { action: "upsert", eventId: "event-1", tenantId: "tenant-1" },
    });
  });

  it("never throws even if the invoke call rejects", async () => {
    mockInvoke.mockRejectedValue(new Error("network down"));
    await expect(syncEventToCalendar("tenant-1", "delete", "event-1")).resolves.toBeUndefined();
  });
});

describe("useGoogleCalendar", () => {
  it("reports connected state and email from a successful connection lookup", async () => {
    mockRpc.mockResolvedValue({
      data: [{ connected: true, google_email: "a@b.com", status: "active" }],
      error: null,
    });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(true);
    expect(result.current.connection?.google_email).toBe("a@b.com");
    expect(result.current.needsReauth).toBe(false);
  });

  it("flags needsReauth when status is needs_reauth", async () => {
    mockRpc.mockResolvedValue({
      data: [{ connected: true, google_email: "a@b.com", status: "needs_reauth" }],
      error: null,
    });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.needsReauth).toBe(true));
  });

  it("defaults to disconnected when there is no row", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { result } = renderWithQueryClient();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connection?.google_email).toBeNull();
  });

  it("does not query when there is no tenantId", () => {
    mockUseTenantId.mockReturnValue({ tenantId: null });
    renderWithQueryClient();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("connect redirects to the OAuth url on success", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockInvoke.mockResolvedValue({ data: { url: "https://accounts.google.com/oauth" }, error: null });
    const { result } = renderWithQueryClient();

    await act(async () => {
      await result.current.connect();
    });

    expect(window.location.href).toBe("https://accounts.google.com/oauth");
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("connect shows an error toast and does not redirect when invoke fails", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockInvoke.mockResolvedValue({ data: null, error: new Error("boom") });
    const { result } = renderWithQueryClient();

    await act(async () => {
      await result.current.connect();
    });

    expect(window.location.href).toBe("");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Could not start Google sign-in", variant: "destructive" })
    );
  });

  it("disconnect invalidates the connection query on success", async () => {
    mockRpc.mockResolvedValue({ data: [{ connected: true, google_email: "a@b.com", status: "active" }], error: null });
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    const { result, queryClient } = renderWithQueryClient();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockInvoke).toHaveBeenCalledWith("gcal-disconnect", { body: { tenantId: "tenant-1" } });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: calendarConnectionKey("tenant-1") });
  });

  it("syncNow invokes a full sync", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    const { result } = renderWithQueryClient();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockInvoke).toHaveBeenCalledWith("gcal-sync", { body: { action: "full", tenantId: "tenant-1" } });
  });
});
