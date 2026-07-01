import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BrandLogo from "./BrandLogo";

describe("BrandLogo", () => {
  it("renders both the icon and the wordmark by default", () => {
    render(<BrandLogo />);
    // SVG has aria-label instead of alt text now
    expect(screen.getByLabelText("SimchaSync Logo")).toBeInTheDocument();
    expect(screen.getByText("Simcha")).toBeInTheDocument();
    expect(screen.getByText("Sync")).toBeInTheDocument();
  });

  it("hides the icon when showIcon is false", () => {
    render(<BrandLogo showIcon={false} />);
    expect(screen.queryByLabelText("SimchaSync Logo")).not.toBeInTheDocument();
    expect(screen.getByText("Simcha")).toBeInTheDocument();
  });

  it("hides the wordmark when showWordmark is false", () => {
    render(<BrandLogo showWordmark={false} />);
    expect(screen.getByLabelText("SimchaSync Logo")).toBeInTheDocument();
    expect(screen.queryByText("Simcha")).not.toBeInTheDocument();
    expect(screen.queryByText("Sync")).not.toBeInTheDocument();
  });

  it("applies dual-tone dark: classes so each half stays WCAG-readable in both themes", () => {
    render(<BrandLogo />);
    expect(screen.getByText("Simcha")).toHaveClass("text-[#112A4D]", "dark:text-white/90");
    expect(screen.getByText("Sync")).toHaveClass("text-[#8A6A24]", "dark:text-[#C7A155]");
  });

  it("applies the requested size's icon and wordmark classes", () => {
    render(<BrandLogo size="lg" />);
    // SVG icon gets the size class from sizeClasses["lg"].icon = "h-20 w-20"
    expect(screen.getByLabelText("SimchaSync Logo")).toHaveClass("h-20", "w-20");
    expect(screen.getByText("Simcha").parentElement).toHaveClass("text-3xl");
  });
});
