// Stripe TEST-mode products + recurring monthly prices, created 2026-06-17 to
// match the displayed prices (Lite $29.99 / Pro $49.99 / Premium $99.99). The
// deployed edge STRIPE_SECRET_KEY must be in TEST mode for these to resolve;
// checkout uses Stripe test cards. Replace with live IDs when going live.
export const SUBSCRIPTION_TIERS = {
  lite: {
    name: "Lite",
    price: "$29.99",
    tagline: "Everything you need to run your bookings.",
    price_id: "price_1TjGbKKlO2rKFnfNvih8m46r",
    product_id: "prod_Uii1r3VBlbkrRf",
    features: [
      "Booking management",
      "Client CRM",
      "Invoice generation & sending",
      "Calendar sync",
      "Hebrew dates & RTL support",
      "File uploads",
    ],
  },
  full: {
    name: "Pro",
    price: "$49.99",
    tagline: "Get paid online and track your profit.",
    price_id: "price_1TjGbLKlO2rKFnfNuZTwE1n2",
    product_id: "prod_Uii1ZvEY5zNx38",
    features: [
      "Everything in Lite",
      "Invite up to 3 people",
      "Booking page with AI features",
      "Accept credit card payments (Stripe)",
      "Payment links & tracking",
      "Expense tracking",
      "Profitability tracking",
      "Per-booking expense management",
      "Financial reports & P&L",
    ],
    popular: true,
  },
  premium: {
    name: "Premium",
    price: "$99.99",
    tagline: "Scale with social tools and priority support.",
    price_id: "price_1TjGbNKlO2rKFnfNQUg83H0a",
    product_id: "prod_Uii1ZCGj6zyTiZ",
    features: [
      "Everything in Pro",
      "Invite up to 5 people",
      "Priority support",
      "Early access to new features",
    ],
  },
} as const;

export type SubscriptionTier = "lite" | "full" | "premium" | "trial" | null;

export function getTierFromProductId(productId: string | null, priceId?: string | null): SubscriptionTier {
  if (productId) {
    if (productId === SUBSCRIPTION_TIERS.lite.product_id) return "lite";
    if (productId === SUBSCRIPTION_TIERS.full.product_id) return "full";
    if (SUBSCRIPTION_TIERS.premium.product_id && productId === SUBSCRIPTION_TIERS.premium.product_id) return "premium";
  }
  // Fallback: detect by price_id if product_id doesn't match
  if (priceId) {
    if (priceId === SUBSCRIPTION_TIERS.lite.price_id) return "lite";
    if (priceId === SUBSCRIPTION_TIERS.full.price_id) return "full";
    if (SUBSCRIPTION_TIERS.premium.price_id && priceId === SUBSCRIPTION_TIERS.premium.price_id) return "premium";
  }
  return null;
}

export const TRIAL_DAYS = 30;

export function getTrialDays(): number {
  return TRIAL_DAYS;
}

export type PlanFeature =
  | "stripe_connect"
  | "social_media"
  | "expenses_profit"
  | "customer_inquiries"
  | "team_invites"
  | "booking_page";

// Team-member cap by plan: Pro can invite up to 3 teammates, Premium up to 5,
// everything else (Lite / trial / none) can't invite. The trial mirrors Lite, so
// no invites. The count is "additional teammates" beyond the owner.
export const PRO_TEAM_LIMIT = 3;
export const PREMIUM_TEAM_LIMIT = 5;
export function teamMemberLimit(tier: SubscriptionTier, plan: string, trialActive: boolean): number {
  if (plan === "trial" && trialActive) return 0;
  if (tier === "premium") return PREMIUM_TEAM_LIMIT;
  if (tier === "full") return PRO_TEAM_LIMIT;
  return 0;
}

export function canAccessFeature(
  plan: string,
  tier: SubscriptionTier,
  trialActive: boolean,
  feature: PlanFeature
): boolean {
  // Social media is parked (kept in drafts, not shipped to production) — off for
  // every plan, including trial.
  if (feature === "social_media") return false;
  // Customer Inquiries is available on every plan (Lite/starter and up, and
  // during the trial) — it lives on the Bookings page, not behind a paid gate.
  if (feature === "customer_inquiries") return true;
  // The free trial mirrors the Lite plan: core features only, advanced ones
  // (stripe_connect, expenses_profit, team_invites, booking_page) stay locked
  // until the user subscribes to Pro/Premium.
  if (plan === "trial" && trialActive) return false;
  // Pro ("full") and Premium have everything else (incl. team invites)
  if (tier === "full" || tier === "premium") return true;
  // Lite plan only has core features (no team invites, stripe_connect, expenses_profit)
  if (tier === "lite") return false;
  return false;
}
