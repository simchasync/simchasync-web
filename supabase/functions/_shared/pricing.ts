/** Amount→plan mapping. Covers both the 2026-06 pricing (Lite $29.99 /
 * Pro $49.99 / Premium $99.99) and the legacy prices existing subscribers
 * are grandfathered on (Lite $59.99 / Full $89.99). Ranges:
 *   ≤ $39.99  → lite    (new Lite)
 *   ≤ $54.99  → full    (new Pro)
 *   ≤ $60.99  → lite    (legacy Lite $59.99)
 *   ≤ $90.99  → full    (legacy Full $89.99)
 *   ≤ $109.99 → premium (Premium $99.99)
 */
export function getPlanFromPrice(amountCents: number): string {
  if (amountCents <= 3999) return "lite";
  if (amountCents <= 5499) return "full";
  if (amountCents <= 6099) return "lite";
  if (amountCents <= 9099) return "full";
  if (amountCents <= 10999) return "premium";
  return "other";
}

/** Team-member cap by resolved plan string. Mirrors `teamMemberLimit` in
 * src/lib/subscription-tiers.ts: Pro ("full") → 3, Premium → 5, everything else
 * (Lite / trial / none) → 0. The count is "additional members" beyond the owner. */
export function teamMemberLimitForPlan(plan: string | null | undefined): number {
  if (plan === "premium") return 5;
  if (plan === "full") return 3;
  return 0;
}

export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const BAN_DURATION_HOURS = "876000h";
