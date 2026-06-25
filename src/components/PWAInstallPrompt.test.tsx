import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import PWAInstallPrompt from "./PWAInstallPrompt";

const STORAGE_KEY = "pwa-install-prompt";
const DELAY_MS = 60_000;

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function setStandalone(standalone: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)" ? standalone : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList);
}

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36";
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setStandalone(false);
  setUserAgent(ANDROID_UA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PWAInstallPrompt", () => {
  it("does not show on desktop user agents", () => {
    setUserAgent(DESKTOP_UA);
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.queryByText("Install SimchaSync")).not.toBeInTheDocument();
  });

  it("does not show when already running standalone", () => {
    setStandalone(true);
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.queryByText("Install SimchaSync")).not.toBeInTheDocument();
  });

  it("shows after the delay on mobile and persists showCount/lastShown", () => {
    render(<PWAInstallPrompt />);
    expect(screen.queryByText("Install SimchaSync")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.getByText("Install SimchaSync")).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.showCount).toBe(1);
    expect(stored.lastShown).toBeTruthy();
  });

  it("does not show again once showCount has reached the max", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showCount: 3, lastShown: null }));
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.queryByText("Install SimchaSync")).not.toBeInTheDocument();
  });

  it("does not show again within the cooldown window", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ showCount: 1, lastShown: new Date().toISOString() })
    );
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.queryByText("Install SimchaSync")).not.toBeInTheDocument();
  });

  it("shows iOS-specific instructions on an iPhone user agent", () => {
    setUserAgent(IOS_UA);
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.getByText(/Tap the Share button/)).toBeInTheDocument();
  });

  it("shows Android-style instructions on a non-iOS mobile user agent", () => {
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.getByText(/Add to Home Screen.*or.*Install App/)).toBeInTheDocument();
  });

  it("dismisses via the X button", () => {
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(screen.getByText("Install SimchaSync")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.queryByText("Install SimchaSync")).not.toBeInTheDocument();
  });

  it("dismisses via the Got it button", () => {
    render(<PWAInstallPrompt />);
    act(() => vi.advanceTimersByTime(DELAY_MS));

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText("Install SimchaSync")).not.toBeInTheDocument();
  });
});
