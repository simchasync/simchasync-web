// Time-of-day driven theme ("auto" mode). Uses the browser's LOCAL clock, so
// it already reflects the visitor's own timezone (USA, Europe, Israel, …) with
// no per-region hardcoding. The day window below is the single source of truth
// for when "auto" shows light vs. dark — tune here, nowhere else.

export type ResolvedTheme = "light" | "dark";

/** Local hour (0–23) at/after which auto mode shows LIGHT. */
export const DAY_START_HOUR = 6;
/** Local hour (0–23) at/after which auto mode shows DARK again. */
export const DAY_END_HOUR = 18;

/** Light during the day window [DAY_START_HOUR, DAY_END_HOUR), dark otherwise. */
export function getTimeBasedTheme(now: Date = new Date()): ResolvedTheme {
  const hour = now.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? "light" : "dark";
}

/**
 * Milliseconds until the next light/dark boundary, so callers can schedule an
 * exact switch instead of polling. Always returns at least 1s to avoid a
 * zero-delay timer loop on the boundary.
 */
export function msUntilNextThemeChange(now: Date = new Date()): number {
  const hour = now.getHours();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);

  if (hour < DAY_START_HOUR) {
    next.setHours(DAY_START_HOUR);
  } else if (hour < DAY_END_HOUR) {
    next.setHours(DAY_END_HOUR);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(DAY_START_HOUR);
  }

  return Math.max(1000, next.getTime() - now.getTime());
}
