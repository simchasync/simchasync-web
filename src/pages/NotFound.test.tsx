import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const en = {
  pageNotFound: {
    code: "404",
    title: "This page is off the set list",
    description: "The URL may be mistyped, or the page was removed.",
    goHome: "Back to home",
    goToApp: "Open dashboard",
  },
};
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import NotFound from "./NotFound";

function renderNotFound() {
  return render(
    <MemoryRouter initialEntries={["/some/missing/route"]}>
      <NotFound />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({ user: null, loading: false });
});

describe("NotFound", () => {
  it("shows the 404 code, title, and description", () => {
    renderNotFound();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("This page is off the set list")).toBeInTheDocument();
  });

  it("shows a link back home", () => {
    renderNotFound();
    expect(screen.getByRole("link", { name: /Back to home/i })).toHaveAttribute("href", "https://simchasync.com");
  });

  it("does not show the dashboard link when logged out", () => {
    renderNotFound();
    expect(screen.queryByRole("link", { name: /Open dashboard/i })).not.toBeInTheDocument();
  });

  it("shows the dashboard link when logged in", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    renderNotFound();
    expect(screen.getByRole("link", { name: /Open dashboard/i })).toHaveAttribute("href", "/app");
  });

  it("does not show the dashboard link while auth is still loading", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: true });
    renderNotFound();
    expect(screen.queryByRole("link", { name: /Open dashboard/i })).not.toBeInTheDocument();
  });
});
