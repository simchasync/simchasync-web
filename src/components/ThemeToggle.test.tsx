import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

const t = {
  app: {
    theme: {
      light: "Light",
      dark: "Dark",
      auto: "Auto",
      switchToLight: "Switch to light mode",
      switchToDark: "Switch to dark mode",
      switchToAuto: "Switch to automatic mode (follows your local time)",
    },
  },
};
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t }),
}));

const mockSetMode = vi.fn();
const mockUseThemeMode = vi.fn();
vi.mock("@/contexts/ThemeModeContext", () => ({
  useThemeMode: () => mockUseThemeMode(),
  THEME_MODES: ["light", "dark", "auto"],
}));

import ThemeToggle from "./ThemeToggle";

beforeEach(() => {
  mockSetMode.mockReset();
  mockUseThemeMode.mockReset();
  mockUseThemeMode.mockReturnValue({ mode: "light", setMode: mockSetMode });
});

describe("ThemeToggle", () => {
  it("renders an aria-hidden placeholder before mount, then the real control", async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByRole("group")).toBeInTheDocument());
  });

  it("default variant renders all three modes with the active one pressed", async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByRole("group")).toBeInTheDocument());

    const light = screen.getByRole("button", { name: "Switch to light mode" });
    const dark = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(light).toHaveAttribute("aria-pressed", "true");
    expect(dark).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a mode button in default variant calls setMode with that mode", async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByRole("group")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(mockSetMode).toHaveBeenCalledWith("dark");
  });

  it("icon variant cycles to the next mode on click", async () => {
    mockUseThemeMode.mockReturnValue({ mode: "light", setMode: mockSetMode });
    render(
      <TooltipProvider>
        <ThemeToggle variant="icon" />
      </TooltipProvider>
    );

    const button = await screen.findByRole("button", { name: "Switch to dark mode" });
    fireEvent.click(button);
    expect(mockSetMode).toHaveBeenCalledWith("dark");
  });

  it("icon variant wraps from the last mode back to the first", async () => {
    mockUseThemeMode.mockReturnValue({ mode: "auto", setMode: mockSetMode });
    render(
      <TooltipProvider>
        <ThemeToggle variant="icon" />
      </TooltipProvider>
    );

    const button = await screen.findByRole("button", { name: "Switch to light mode" });
    fireEvent.click(button);
    expect(mockSetMode).toHaveBeenCalledWith("light");
  });
});
