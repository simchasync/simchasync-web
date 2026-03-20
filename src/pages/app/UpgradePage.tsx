import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Crown, Zap, ExternalLink, ArrowLeft, Clock, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useTenantId } from "@/hooks/useTenantId";

export default function UpgradePage() {
  const { t } = useLanguage();
  const { tenantId } = useTenantId();
  const {
    plan, tier, trialExpired, trialDaysLeft, trialActive,
    subscribed, subscriptionEnd, canceling,
  } = useSubscription();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleCheckout = async (priceId: string, tierKey: string) => {
    if (!tenantId) return;
    setLoadingTier(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { price_id: priceId, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned. Please try again.");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout.", variant: "destructive" });
      setLoadingTier(null);
    }
  };

  const handleManageOnStripe = async () => {
    if (!tenantId) return;
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPortal(false);
    }
  };

  const tiers = [
    { key: "lite" as const, icon: Zap, ...SUBSCRIPTION_TIERS.lite },
    { key: "full" as const, icon: Crown, popular: true, ...SUBSCRIPTION_TIERS.full },
  ];

  const currentTierData = tier ? SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS] : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/app/settings")} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {plan === "none"
            ? "Activate This Workspace"
            : subscribed
              ? "Your Subscription"
              : trialExpired
                ? "Your Trial Has Ended"
                : "Choose Your Plan"}
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          {plan === "none"
            ? "This workspace is not yet active. Subscribe to a plan to start using it."
            : subscribed
              ? "View your current plan or switch to a different one."
              : trialExpired
                ? "Select a plan to continue using SimchaSync."
                : "Simple, transparent pricing for your music business."}
        </p>
      </div>

      {/* Inactive workspace banner */}
      {plan === "none" && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            This workspace requires its own subscription. Each workspace operates as an independent account.
          </span>
        </div>
      )}

      {/* Trial / Status Banner */}
      {trialActive && !subscribed && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            Your free trial ends in <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong>.
            Choose a plan below to continue without interruption.
          </span>
        </div>
      )}

      {trialExpired && !subscribed && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Your trial has expired. Subscribe to a plan to regain access.</span>
        </div>
      )}

      {/* Current Plan Summary (for subscribers) */}
      {subscribed && currentTierData && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-semibold text-lg">{currentTierData.name} Plan</p>
                <p className="text-sm text-muted-foreground">
                  {currentTierData.price}/month
                  {subscriptionEnd && (
                    <> · {canceling ? "Active until" : "Renews"} {new Date(subscriptionEnd).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canceling && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
                  Cancels at period end
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageOnStripe}
                disabled={loadingPortal}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {loadingPortal ? "Loading..." : "Billing Portal"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {tiers.map((t) => {
          const isCurrentPlan = subscribed && tier === t.key;
          return (
            <Card
              key={t.key}
              className={`relative transition-shadow ${
                isCurrentPlan
                  ? "border-primary ring-2 ring-primary/20 shadow-lg"
                  : t.key === "full"
                    ? "border-primary/50 shadow-md"
                    : ""
              }`}
            >
              {isCurrentPlan && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Current Plan
                </Badge>
              )}
              {!isCurrentPlan && t.key === "full" && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <t.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-display text-xl">{t.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">{t.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {t.features.map((f) => {
                    const isComingSoon = f.includes("Coming Soon") || f.includes("בקרוב");
                    const label = isComingSoon ? f.replace(/ — Coming Soon| — בקרוב/, "") : f;
                    return (
                      <li key={f} className={`flex items-start gap-2 text-sm ${isComingSoon ? "text-muted-foreground" : ""}`}>
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${isComingSoon ? "text-muted-foreground/50" : "text-primary"}`} />
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {label}
                          {isComingSoon && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              Coming Soon
                            </Badge>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {isCurrentPlan ? (
                  <Button className="w-full min-h-[44px]" variant="outline" disabled>
                    <Check className="mr-2 h-4 w-4" />
                    Current Plan
                  </Button>
                ) : subscribed ? (
                  <Button
                    className="w-full min-h-[44px] bg-gradient-gold text-primary-foreground touch-manipulation"
                    onClick={handleManageOnStripe}
                    disabled={loadingPortal}
                  >
                    {loadingPortal ? "Loading..." : `Switch to ${t.name}`}
                  </Button>
                ) : (
                  <Button
                    className="w-full min-h-[44px] bg-gradient-gold text-primary-foreground touch-manipulation"
                    onClick={() => handleCheckout(t.price_id, t.key)}
                    disabled={loadingTier === t.key}
                  >
                    {loadingTier === t.key ? "Loading..." : `Subscribe to ${t.name}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer help text */}
      <p className="text-center text-xs text-muted-foreground">
        All plans include a 30-day free trial. Cancel anytime from your billing portal.
      </p>
    </div>
  );
}
