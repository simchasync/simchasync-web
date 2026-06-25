import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { en } from "@/i18n/en";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import UpgradePage from "./UpgradePage";

function renderUpgradePage() {
  return render(
    <MemoryRouter>
      <UpgradePage />
    </MemoryRouter>,
  );
}

function baseSubscription(overrides: Record<string, unknown> = {}) {
  return {
    plan: "trial",
    tier: "trial",
    trialExpired: false,
    trialDaysLeft: 10,
    trialActive: true,
    subscribed: false,
    subscriptionEnd: null,
    canceling: false,
    loading: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseSubscription.mockReset();
  mockUseTenantId.mockReset();
  mockToast.mockReset();
  mockNavigate.mockReset();
  mockInvoke.mockReset();

  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
  mockUseSubscription.mockReturnValue(baseSubscription());

  const originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, href: "" },
  });
});

describe("UpgradePage", () => {
  it("shows a loading skeleton while subscription data loads", () => {
    mockUseSubscription.mockReturnValue(baseSubscription({ loading: true }));
    renderUpgradePage();
    expect(screen.queryByText("Choose Your Plan")).not.toBeInTheDocument();
  });

  it("shows the trial banner during an active trial", () => {
    renderUpgradePage();
    expect(screen.getByText(/Your free trial ends in 10 day\(s\)/)).toBeInTheDocument();
  });

  it("shows the trial-expired banner and title when the trial has ended", () => {
    mockUseSubscription.mockReturnValue(baseSubscription({ trialActive: false, trialExpired: true }));
    renderUpgradePage();
    expect(screen.getByText("Your Trial Has Ended")).toBeInTheDocument();
    expect(screen.getByText("Your trial has expired. Subscribe to a plan to regain access.")).toBeInTheDocument();
  });

  it("shows the inactive-workspace banner when plan is none", () => {
    mockUseSubscription.mockReturnValue(baseSubscription({ plan: "none", trialActive: false }));
    renderUpgradePage();
    expect(screen.getByText("Activate This Workspace")).toBeInTheDocument();
    expect(screen.getByText(/This workspace requires its own subscription/)).toBeInTheDocument();
  });

  it("shows the current plan card and billing portal button when subscribed", () => {
    mockUseSubscription.mockReturnValue(
      baseSubscription({ subscribed: true, tier: "full", trialActive: false, subscriptionEnd: "2026-12-01" }),
    );
    renderUpgradePage();
    expect(screen.getByText("Your Subscription")).toBeInTheDocument();
    expect(screen.getAllByText("Current Plan").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Billing Portal/i })).toBeInTheDocument();
  });

  it("starts checkout for a plan when not subscribed", async () => {
    mockInvoke.mockResolvedValue({ data: { url: "https://checkout.stripe.com/abc" }, error: null });
    renderUpgradePage();

    fireEvent.click(screen.getByRole("button", { name: /Subscribe to Pro/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create-checkout",
        expect.objectContaining({ body: expect.objectContaining({ tenant_id: "tenant-1" }) }),
      );
    });
  });

  it("shows an error toast when checkout fails", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("Stripe is down") });
    renderUpgradePage();

    fireEvent.click(screen.getByRole("button", { name: /Subscribe to Pro/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error", description: "Stripe is down" }),
      );
    });
  });

  it("opens the Stripe customer portal when managing an existing subscription", async () => {
    mockInvoke.mockResolvedValue({ data: { url: "https://billing.stripe.com/abc" }, error: null });
    mockUseSubscription.mockReturnValue(baseSubscription({ subscribed: true, tier: "full", trialActive: false }));
    renderUpgradePage();

    fireEvent.click(screen.getByRole("button", { name: /Billing Portal/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "customer-portal",
        expect.objectContaining({ body: { tenant_id: "tenant-1" } }),
      );
    });
  });

  it("navigates back to settings", () => {
    renderUpgradePage();
    fireEvent.click(screen.getByRole("button", { name: /Back to Settings/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/app/settings");
  });
});
