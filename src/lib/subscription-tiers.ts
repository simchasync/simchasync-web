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
      "Team invites",
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
      "Social media management — Coming Soon",
      "Multi-platform posting — Coming Soon",
      "Social media analytics — Coming Soon",
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

export function canAccessFeature(
  plan: string,
  tier: SubscriptionTier,
  trialActive: boolean,
  _feature: "stripe_connect" | "social_media" | "expenses_profit"
): boolean {
  // During trial, everything is accessible
  if (plan === "trial" && trialActive) return true;
  // Pro ("full") and Premium have everything
  if (tier === "full" || tier === "premium") return true;
  // Lite plan only has core features (no stripe_connect, social_media, expenses_profit)
  if (tier === "lite") return false;
  return false;
}
