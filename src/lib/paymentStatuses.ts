// Payment state for a booking. Mirrors the DB enum and the
// EventPaymentStatus type used in eventPaymentStatus.ts.
export const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DEFAULT_PAYMENT_STATUS: PaymentStatus = "unpaid";

export function isKnownPaymentStatus(
  value: string | null | undefined
): value is PaymentStatus {
  return !!value && (PAYMENT_STATUSES as readonly string[]).includes(value);
}
