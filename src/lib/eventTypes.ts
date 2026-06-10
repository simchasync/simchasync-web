// Common event categories offered in the Event Type selector.
// Selecting "other" reveals a free-text input — any value not in this
// list is treated as a custom event type and displayed as-is.
export const EVENT_TYPES = [
  "wedding",
  "bar_mitzvah",
  "bat_mitzvah",
  "corporate",
  "concert",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function isKnownEventType(value: string | null | undefined): value is EventType {
  return !!value && (EVENT_TYPES as readonly string[]).includes(value);
}
