// NOTE: displayed prices were updated 2026-06-12 (Lite $29.99 / Pro $49.99 /
// Premium $99.99). The Stripe price_ids below still point at the OLD Stripe
// prices until new prices are created in the Stripe dashboard — see the
// session log's Pending Action. Premium has no Stripe ids yet (checkout
// disabled until they exist).
export const SUBSCRIPTION_TIERS = {
  lite: {
    name: "Lite",
    price: "$29.99",
    price_id: "price_1TAb41GgnW7qov4TpKHgrKOO",
    product_id: "prod_U8spCJqXtpChBf",
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
    price_id: "price_1T7OlrRfOygaToU0wmN7SP2j",
    product_id: "prod_U5ZvhJFTk8TKNu",
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
    price_id: "",
    product_id: "",
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
