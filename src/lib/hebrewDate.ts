/**
 * Converts a Gregorian date to an approximate Hebrew date string.
 * Uses the Intl API with Hebrew calendar for reliable conversion.
 */
export function toHebrewDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    // Use Intl.DateTimeFormat with Hebrew calendar
    const formatter = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatter.format(d);
  } catch {
    return "";
  }
}
