import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

import { useRealtimeInvalidate } from "./useRealtimeInvalidate";

const FAKE_CHANNEL = { id: "fake-channel" };

function renderWithQueryClient(props: Parameters<typeof useRealtimeInvalidate>[0]) {
  const queryClient = new QueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useRealtimeInvalidate(props), { wrapper });
  return { ...view, invalidateSpy };
}

beforeEach(() => {
  mockOn.mockReset();
  mockSubscribe.mockReset();
  mockChannel.mockReset();
  mockRemoveChannel.mockReset();

  mockOn.mockReturnValue({ subscribe: mockSubscribe });
  mockSubscribe.mockReturnValue(FAKE_CHANNEL);
  mockChannel.mockReturnValue({ on: mockOn });
});

describe("useRealtimeInvalidate", () => {
  it("subscribes to postgres_changes on the given channel/table/filter", () => {
    renderWithQueryClient({
      channel: "events-tenant1",
      table: "events",
      filter: "tenant_id=eq.tenant1",
      queryKey: ["events", "tenant1"],
    });

    expect(mockChannel).toHaveBeenCalledWith("events-tenant1");
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "events", filter: "tenant_id=eq.tenant1" },
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("invalidates the given query key when a change event fires", () => {
    const { invalidateSpy } = renderWithQueryClient({
      channel: "events-tenant1",
      table: "events",
      filter: "tenant_id=eq.tenant1",
      queryKey: ["events", "tenant1"],
    });

    const onChangeHandler = mockOn.mock.calls[0][2];
    onChangeHandler();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["events", "tenant1"] });
  });

  it("does not subscribe when enabled is false", () => {
    renderWithQueryClient({
      channel: "events-tenant1",
      table: "events",
      filter: "tenant_id=eq.tenant1",
      queryKey: ["events", "tenant1"],
      enabled: false,
    });

    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderWithQueryClient({
      channel: "events-tenant1",
      table: "events",
      filter: "tenant_id=eq.tenant1",
      queryKey: ["events", "tenant1"],
    });

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(FAKE_CHANNEL);
  });
});
