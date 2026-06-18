import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { getTimeBasedTheme, msUntilNextThemeChange } from "@/lib/autoTheme";

// The user's chosen theme PREFERENCE. "auto" resolves to light/dark from the
// local clock (see src/lib/autoTheme.ts). next-themes still owns applying the
// concrete light/dark class; this layer only decides which one to hand it.
export type ThemeMode = "light" | "dark" | "auto";

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

const MODE_STORAGE_KEY = "simchasync-theme-mode";
// next-themes' own key — read once to migrate existing users who picked a
// concrete theme before "auto" existed, so their choice isn't reset to light.
const THEME_STORAGE_KEY = "simchasync-theme";

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "auto";
}

function readInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
  if (isThemeMode(stored)) return stored;
  const legacy = window.localStorage.getItem(THEME_STORAGE_KEY);
  return legacy === "dark" || legacy === "light" ? legacy : "light";
}

interface ThemeModeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { setTheme } = useTheme();
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    if (mode !== "auto") {
      setTheme(mode);
      return;
    }

    // Auto: apply the time-based theme now, then re-apply exactly at each
    // light/dark boundary, and whenever the tab regains focus (covers the
    // machine waking from sleep or a long-idle tab crossing a boundary).
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      setTheme(getTimeBasedTheme());
      timer = setTimeout(schedule, msUntilNextThemeChange());
    };
    schedule();

    const onVisibility = () => {
      if (document.visibilityState === "visible") setTheme(getTimeBasedTheme());
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, setTheme]);

  return <ThemeModeContext.Provider value={{ mode, setMode }}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within a ThemeModeProvider");
  return ctx;
}
