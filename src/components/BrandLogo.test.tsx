import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BrandLogo from "./BrandLogo";

describe("BrandLogo", () => {
  it("renders both the icon and the wordmark by default", () => {
    render(<BrandLogo />);
    expect(screen.getByLabelText("SimchaSync Logo")).toBeInTheDocument();
    expect(screen.getByText("SimchaSync")).toBeInTheDocument();
  });

  it("hides the icon when showIcon is false", () => {
    render(<BrandLogo showIcon={false} />);
    expect(screen.queryByLabelText("SimchaSync Logo")).not.toBeInTheDocument();
    expect(screen.getByText("SimchaSync")).toBeInTheDocument();
  });

  it("hides the wordmark when showWordmark is false", () => {
    render(<BrandLogo showWordmark={false} />);
    expect(screen.getByLabelText("SimchaSync Logo")).toBeInTheDocument();
    expect(screen.queryByText("SimchaSync")).not.toBeInTheDocument();
  });

  it("applies gold gradient style to the wordmark", () => {
    render(<BrandLogo />);
    const wordmark = screen.getByText("SimchaSync");
    expect(wordmark).toHaveStyle({ backgroundClip: "text" });
  });

  it("applies the requested size icon and wordmark classes", () => {
    render(<BrandLogo size="lg" />);
    expect(screen.getByLabelText("SimchaSync Logo")).toHaveClass("h-9", "w-9");
    expect(screen.getByText("SimchaSync")).toHaveClass("text-3xl");
  });
});
