import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

let resolvedValue: unknown = { data: [], error: null };

function makeBuilder(): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject);
  return builder;
}

let builders: Builder[] = [];
const mockFrom = vi.fn((..._args: unknown[]) => {
  const builder = makeBuilder();
  builders.push(builder);
  return builder;
});

function builderThatCalled(method: "delete" | "update") {
  return builders.find((b) => b[method].mock.calls.length > 0);
}

const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockChannel = vi.fn((..._args: unknown[]) => ({ on: mockOn }));
const mockRemoveChannel = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import NotificationsDropdown from "./NotificationsDropdown";

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    title: "New booking request",
    message: "Someone requested a date",
    link: null,
    read: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderDropdown() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<NotificationsDropdown />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  builders = [];
  mockOn.mockReset();
  mockSubscribe.mockReset();
  mockChannel.mockClear();
  mockRemoveChannel.mockReset();
  mockUseAuth.mockReset();
  mockToast.mockReset();

  mockOn.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  resolvedValue = { data: [], error: null };
});

describe("NotificationsDropdown", () => {
  it("shows no unread badge when there are no unread notifications", async () => {
    resolvedValue = { data: [makeNotification({ read: true })], error: null };
    renderDropdown();
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("shows the unread count badge, capped at 9+", async () => {
    resolvedValue = {
      data: Array.from({ length: 12 }, (_, i) => makeNotification({ id: `n${i}`, read: false })),
      error: null,
    };
    renderDropdown();
    await waitFor(() => expect(screen.getByText("9+")).toBeInTheDocument());
  });

  it("opens the popover and shows the empty state when there are no notifications", async () => {
    resolvedValue = { data: [], error: null };
    renderDropdown();
    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(await screen.findByText("No notifications")).toBeInTheDocument();
  });

  it("opens the popover and lists fetched notifications", async () => {
    resolvedValue = { data: [makeNotification()], error: null };
    renderDropdown();
    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(await screen.findByText("New booking request")).toBeInTheDocument();
    expect(screen.getByText("Someone requested a date")).toBeInTheDocument();
  });

  it("subscribes to realtime inserts/deletes scoped to the user", async () => {
    renderDropdown();
    await waitFor(() => expect(mockChannel).toHaveBeenCalledWith("notifications-realtime-user-1"));
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "INSERT", table: "notifications", filter: "user_id=eq.user-1" }),
      expect.any(Function)
    );
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "DELETE", table: "notifications", filter: "user_id=eq.user-1" }),
      expect.any(Function)
    );
  });

  it("marks all read via update().eq(user_id).eq(read=false) when clicked", async () => {
    resolvedValue = { data: [makeNotification({ read: false })], error: null };
    renderDropdown();
    fireEvent.click(screen.getByRole("button", { name: "" }));
    const markAllButton = await screen.findByRole("button", { name: /Mark all read/i });

    fireEvent.click(markAllButton);

    await waitFor(() => {
      const builder = builderThatCalled("update");
      expect(builder?.update).toHaveBeenCalledWith({ read: true });
      expect(builder?.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(builder?.eq).toHaveBeenCalledWith("read", false);
    });
  });

  it("deletes a single notification when its delete button is clicked", async () => {
    resolvedValue = { data: [makeNotification()], error: null };
    renderDropdown();
    fireEvent.click(screen.getByRole("button", { name: "" }));
    const deleteButton = await screen.findByRole("button", { name: "Delete notification" });

    fireEvent.click(deleteButton);

    await waitFor(() => {
      const builder = builderThatCalled("delete");
      expect(builder).toBeTruthy();
      expect(builder?.eq).toHaveBeenCalledWith("id", "n1");
      expect(builder?.eq).toHaveBeenCalledWith("user_id", "user-1");
    });
  });

  it("opens a confirm dialog before deleting all read notifications, then deletes on confirm", async () => {
    resolvedValue = { data: [makeNotification({ read: true })], error: null };
    renderDropdown();
    fireEvent.click(screen.getByRole("button", { name: "" }));
    const deleteAllReadButton = await screen.findByRole("button", { name: /Delete all read/i });

    fireEvent.click(deleteAllReadButton);
    expect(await screen.findByText("Delete all read notifications?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete all read" }));

    await waitFor(() => {
      const builder = builderThatCalled("delete");
      expect(builder).toBeTruthy();
      expect(builder?.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(builder?.eq).toHaveBeenCalledWith("read", true);
    });
  });
});
