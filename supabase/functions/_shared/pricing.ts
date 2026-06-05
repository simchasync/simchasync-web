export const PRICE_TIERS = {
  LITE_MAX_CENTS: 6099,
  FULL_MAX_CENTS: 9099,
} as const;

export function getPlanFromPrice(amountCents: number): string {
  if (amountCents <= PRICE_TIERS.LITE_MAX_CENTS) return "lite";
  if (amountCents <= PRICE_TIERS.FULL_MAX_CENTS) return "full";
  return "other";
}

export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const BAN_DURATION_HOURS = "876000h";
