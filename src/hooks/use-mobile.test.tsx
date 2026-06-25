import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

function mockMatchMedia() {
  let listener: (() => void) | undefined;
  const mql = {
    addEventListener: (_: string, cb: () => void) => {
      listener = cb;
    },
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return { fireChange: () => listener?.() };
}

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: originalInnerWidth });
});

describe("useIsMobile", () => {
  it("reports false when the viewport is wider than the breakpoint", () => {
    mockMatchMedia();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("reports true when the viewport is narrower than the breakpoint", () => {
    mockMatchMedia();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when the viewport crosses the breakpoint after a matchMedia change event", () => {
    const { fireChange } = mockMatchMedia();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    act(() => fireChange());
    expect(result.current).toBe(true);
  });
});
