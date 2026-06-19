// How a travel fee is treated financially: billed to the customer (revenue)
// or absorbed as a business expense.
export const TRAVEL_FEE_TYPES = ["charge_customer", "expense"] as const;

export type TravelFeeType = (typeof TRAVEL_FEE_TYPES)[number];

export const DEFAULT_TRAVEL_FEE_TYPE: TravelFeeType = "expense";

export function isKnownTravelFeeType(
  value: string | null | undefined
): value is TravelFeeType {
  return !!value && (TRAVEL_FEE_TYPES as readonly string[]).includes(value);
}
