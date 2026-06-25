import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import AuthRedirect from "./AuthRedirect";

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}{location.hash}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthRedirect />
      <Routes>
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>
  );
}

const originalHash = window.location.hash;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  window.location.hash = originalHash;
});

describe("AuthRedirect", () => {
  it("redirects to /reset-password when the hash has an invite token", () => {
    window.location.hash = "#access_token=abc&type=invite";
    const { getByTestId } = renderAt("/app");
    expect(getByTestId("path").textContent).toBe("/reset-password#access_token=abc&type=invite");
  });

  it("redirects to /reset-password when the hash has a recovery token", () => {
    window.location.hash = "#access_token=abc&type=recovery";
    const { getByTestId } = renderAt("/app");
    expect(getByTestId("path").textContent).toBe("/reset-password#access_token=abc&type=recovery");
  });

  it("does not redirect when there is no relevant hash", () => {
    window.location.hash = "";
    const { getByTestId } = renderAt("/app");
    expect(getByTestId("path").textContent).toBe("/app");
  });

  it("does not redirect again when already on /reset-password", () => {
    window.location.hash = "#access_token=abc&type=invite";
    const { getByTestId } = renderAt("/reset-password");
    expect(getByTestId("path").textContent).toBe("/reset-password");
  });
});
