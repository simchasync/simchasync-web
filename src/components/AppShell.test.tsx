import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const en = {
  app: {
    nav: {
      dashboard: "Dashboard",
      bookings: "Bookings",
      clients: "Clients",
      invoices: "Invoices",
      agents: "Agents",
      finance: "Finance",
      team: "Team",
      social: "Social",
      support: "Support",
      bookingPage: "Booking Page",
      settings: "Settings",
    },
  },
};
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

const mockUseUserRole = vi.fn();
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock("@/components/TrialBanner", () => ({
  TrialBanner: () => <div data-testid="trial-banner" />,
}));
vi.mock("@/components/NotificationsDropdown", () => ({ default: () => <div data-testid="notifications" /> }));
vi.mock("@/components/PWAInstallPrompt", () => ({ default: () => <div data-testid="pwa-prompt" /> }));
vi.mock("@/components/WorkspaceSwitcher", () => ({ default: () => <div data-testid="workspace-switcher" /> }));
vi.mock("@/components/LanguageSwitcher", () => ({ default: () => <div data-testid="language-switcher" /> }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => <div data-testid="theme-toggle" /> }));
vi.mock("@/components/PageTransition", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/theme/MuiThemeBridge", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import AppShell from "./AppShell";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<div data-testid="page">dashboard page</div>} />
          <Route path="bookings" element={<div data-testid="page">bookings page</div>} />
          <Route path="settings" element={<div data-testid="page">settings page</div>} />
          <Route path="upgrade" element={<div data-testid="page">upgrade page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseUserRole.mockReset();
  mockUseSubscription.mockReset();

  mockUseAuth.mockReturnValue({
    user: { id: "user-1", user_metadata: { phone: "+15551234567" } },
    loading: false,
    signOut: vi.fn(),
  });
  mockUseUserRole.mockReturnValue({ role: "owner" });
  mockUseSubscription.mockReturnValue({
    loading: false,
    workspaceActive: true,
    canAccess: () => true,
  });
});

describe("AppShell", () => {
  it("shows a loading spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: vi.fn() });
    const { container } = renderAt("/app");
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders nothing and does not crash when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });
    const { container } = renderAt("/app");
    expect(container.firstChild).toBeNull();
  });

  it("renders the dashboard nav item for an owner and shows the outlet content", () => {
    renderAt("/app");
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getByTestId("page")).toHaveTextContent("dashboard page");
  });

  it("hides owner-only nav items (invoices, team, settings) for a booking_manager", () => {
    mockUseUserRole.mockReturnValue({ role: "booking_manager" });
    renderAt("/app/bookings");
    expect(screen.getAllByText("Bookings").length).toBeGreaterThan(0);
    expect(screen.queryByText("Invoices")).not.toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("hides Finance and Agents for an owner without expenses_profit access", () => {
    mockUseSubscription.mockReturnValue({
      loading: false,
      workspaceActive: true,
      canAccess: (feature: string) => feature !== "expenses_profit",
    });
    renderAt("/app");
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
    expect(screen.queryByText("Agents")).not.toBeInTheDocument();
    expect(screen.getAllByText("Bookings").length).toBeGreaterThan(0);
  });

  it("shows the TrialBanner for an owner on an active workspace", () => {
    renderAt("/app");
    expect(screen.getByTestId("trial-banner")).toBeInTheDocument();
  });

  it("hides the TrialBanner for a social_media_manager", () => {
    mockUseUserRole.mockReturnValue({ role: "social_media_manager" });
    renderAt("/app");
    expect(screen.queryByTestId("trial-banner")).not.toBeInTheDocument();
  });

  it("shows the Workspace inactive message and no nav items when the workspace is inactive", async () => {
    mockUseSubscription.mockReturnValue({ loading: false, workspaceActive: false, canAccess: () => true });
    renderAt("/app/upgrade");
    await waitFor(() => expect(screen.getByText("Workspace inactive")).toBeInTheDocument());
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("does not redirect away from /app/upgrade even when the workspace is active", async () => {
    renderAt("/app/upgrade");
    await waitFor(() => expect(screen.getByTestId("page")).toHaveTextContent("upgrade page"));
  });

  it("redirects to /app/upgrade when the workspace is inactive and not already there", async () => {
    mockUseSubscription.mockReturnValue({ loading: false, workspaceActive: false, canAccess: () => true });
    renderAt("/app");
    await waitFor(() => expect(screen.getByTestId("page")).toHaveTextContent("upgrade page"));
  });

  it("redirects to the first allowed nav route when the current path isn't permitted for the role", async () => {
    mockUseUserRole.mockReturnValue({ role: "booking_manager" });
    renderAt("/app/settings");
    await waitFor(() => expect(screen.getByTestId("page")).toHaveTextContent("dashboard page"));
  });
});
