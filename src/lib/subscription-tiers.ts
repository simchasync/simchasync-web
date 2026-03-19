export const SUBSCRIPTION_TIERS = {
  lite: {
    name: "Lite",
    price: "$59.99",
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
    name: "Full Platform",
    price: "$89.99",
    price_id: "price_1T7OlrRfOygaToU0wmN7SP2j",
    product_id: "prod_U5ZvhJFTk8TKNu",
    features: [
      "Everything in Lite",
      "Accept credit card payments (Stripe)",
      "Payment links & tracking",
      "Expense tracking",
      "Profitability tracking",
      "Per-booking expense management",
      "Social media management — Coming Soon",
      "Multi-platform posting — Coming Soon",
      "Social media analytics — Coming Soon",
      "Priority support",
    ],
    popular: true,
  },
} as const;

export type SubscriptionTier = "lite" | "full" | "trial" | null;

export function getTierFromProductId(productId: string | null, priceId?: string | null): SubscriptionTier {
  if (productId) {
    if (productId === SUBSCRIPTION_TIERS.lite.product_id) return "lite";
    if (productId === SUBSCRIPTION_TIERS.full.product_id) return "full";
  }
  if (priceId) {
    if (priceId === SUBSCRIPTION_TIERS.lite.price_id) return "lite";
    if (priceId === SUBSCRIPTION_TIERS.full.price_id) return "full";
  }
  return null;
}

export function canAccessFeature(
  plan: string,
  tier: SubscriptionTier,
  trialActive: boolean,
  feature: "stripe_connect" | "social_media" | "expenses_profit"
): boolean {
  if (plan === "trial" && trialActive) return true;
  if (tier === "full") return true;
  if (tier === "lite") return false;
  return false;
}