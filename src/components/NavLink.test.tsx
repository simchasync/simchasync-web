import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NavLink } from "./NavLink";

function renderAt(path: string, to: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <NavLink to={to} className="base" activeClassName="active" pendingClassName="pending">
              Link
            </NavLink>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("NavLink", () => {
  it("applies the base className but not activeClassName when not on the target route", () => {
    renderAt("/other", "/target");
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveClass("base");
    expect(link).not.toHaveClass("active");
  });

  it("applies the base and activeClassName when on the target route", () => {
    renderAt("/target", "/target");
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveClass("base", "active");
  });

  it("sets the href to the target path", () => {
    renderAt("/other", "/target");
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveAttribute("href", "/target");
  });
});
