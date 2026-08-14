// Formats a stored 24-hour "HH:MM" time string as US-style 12-hour time,
// e.g. "18:30" -> "6:30 PM", "09:05" -> "9:05 AM". Returns "" for empty input
// and passes through anything that doesn't look like a time.
export function formatTimeUS(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value).trim());
  if (!m) return String(value);
  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  if (Number.isNaN(hours)) return String(value);
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}
