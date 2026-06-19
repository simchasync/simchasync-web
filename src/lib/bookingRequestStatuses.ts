// Pipeline statuses for an incoming public booking request.
export const BOOKING_REQUEST_STATUSES = [
  "new",
  "contacted",
  "booked",
  "declined",
] as const;

export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

export function isKnownBookingRequestStatus(
  value: string | null | undefined
): value is BookingRequestStatus {
  return !!value && (BOOKING_REQUEST_STATUSES as readonly string[]).includes(value);
}
