// Common venue categories offered in the Venue Type selector.
// Selecting "other" reveals a free-text input — any value not in this
// list is treated as a custom venue type and displayed as-is.
export const VENUE_TYPES = [
  "hotel",
  "function_hall",
  "banquet_hall",
  "garden",
  "synagogue",
  "restaurant",
  "country_club",
  "private_residence",
] as const;

export type VenueType = (typeof VENUE_TYPES)[number];

export function isKnownVenueType(value: string | null | undefined): value is VenueType {
  return !!value && (VENUE_TYPES as readonly string[]).includes(value);
}
