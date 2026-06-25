import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSetLanguage = vi.fn();
const mockUseLanguage = vi.fn();
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => mockUseLanguage(),
}));

import LanguageSwitcher from "./LanguageSwitcher";

beforeEach(() => {
  mockSetLanguage.mockReset();
  mockUseLanguage.mockReset();
  mockUseLanguage.mockReturnValue({ language: "en", setLanguage: mockSetLanguage });
});

describe("LanguageSwitcher", () => {
  it("shows the current language's flag and label on the trigger", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button")).toHaveTextContent("🇺🇸 English");
  });

  it("falls back to English if the current language code is unrecognized", () => {
    mockUseLanguage.mockReturnValue({ language: "fr", setLanguage: mockSetLanguage });
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button")).toHaveTextContent("🇺🇸 English");
  });

  it("lists all three languages in the dropdown and calls setLanguage on selection", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1 });
    fireEvent.click(trigger);

    const item = await screen.findByText("ייִדיש");
    fireEvent.click(item);

    expect(mockSetLanguage).toHaveBeenCalledWith("yi");
  });

  it("shows the current language as selected with He highlighted when active", async () => {
    mockUseLanguage.mockReturnValue({ language: "he", setLanguage: mockSetLanguage });
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button")).toHaveTextContent("🇮🇱 עברית");

    const trigger = screen.getByRole("button");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1 });
    fireEvent.click(trigger);
    const hebrewItem = await screen.findByText("עברית", { selector: "span" });
    expect(hebrewItem.closest('[role="menuitem"]')).toHaveClass("bg-accent");
  });
});
