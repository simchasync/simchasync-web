import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TrialBanner } from "./TrialBanner";

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderBanner() {
  return render(
    <MemoryRouter>
      <TrialBanner />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseSubscription.mockReset();
  mockNavigate.mockReset();
});

describe("TrialBanner", () => {
  it("renders nothing while loading", () => {
    mockUseSubscription.mockReturnValue({ loading: true, plan: "trial", subscribed: false, trialActive: true, trialExpired: false, trialDaysLeft: 3 });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when already subscribed", () => {
    mockUseSubscription.mockReturnValue({ loading: false, plan: "trial", subscribed: true, trialActive: true, trialExpired: false, trialDaysLeft: 3 });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the plan is not trial", () => {
    mockUseSubscription.mockReturnValue({ loading: false, plan: "pro", subscribed: false, trialActive: false, trialExpired: false, trialDaysLeft: 0 });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the expired banner and navigates to /app/upgrade on click", () => {
    mockUseSubscription.mockReturnValue({ loading: false, plan: "trial", subscribed: false, trialActive: false, trialExpired: true, trialDaysLeft: 0 });
    renderBanner();
    expect(screen.getByText(/trial has ended/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upgrade Now" }));
    expect(mockNavigate).toHaveBeenCalledWith("/app/upgrade");
  });

  it("shows the active-trial banner with singular day phrasing for 1 day left", () => {
    mockUseSubscription.mockReturnValue({ loading: false, plan: "trial", subscribed: false, trialActive: true, trialExpired: false, trialDaysLeft: 1 });
    renderBanner();
    expect(screen.getByText("1 day left in your free trial")).toBeInTheDocument();
  });

  it("shows the active-trial banner with plural days phrasing for >1 day left", () => {
    mockUseSubscription.mockReturnValue({ loading: false, plan: "trial", subscribed: false, trialActive: true, trialExpired: false, trialDaysLeft: 5 });
    renderBanner();
    expect(screen.getByText("5 days left in your free trial")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Plans" }));
    expect(mockNavigate).toHaveBeenCalledWith("/app/upgrade");
  });
});
