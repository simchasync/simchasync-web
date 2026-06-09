import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { SUBSCRIPTION_TIERS, getTrialDays } from "@/lib/subscription-tiers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, ExternalLink, ArrowLeft, Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useTenantId } from "@/hooks/useTenantId";

type TierKey = keyof typeof SUBSCRIPTION_TIERS;

interface TierCard {
  key: TierKey;
  icon: typeof Crown;
  popular: boolean;
  name: string;
  price: string;
  price_id: string;
  features: readonly string[];
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An unexpected error occurred.";
}

function useCheckout() {
  const { tenantId } = useTenantId();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);

  const handleCheckout = async (priceId: string, tierKey: TierKey) => {
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
        throw new Error("No checkout URL returned.");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      setLoadingTier(null);
    }
  };

  return { loadingTier, handleCheckout };
}

function useCustomerPortal() {
  const { tenantId } = useTenantId();
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleManageOnStripe = async () => {
    if (!tenantId) return;
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Error",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  return { loadingPortal, handleManageOnStripe };
}

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease },
  }),
};

function PlansSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-24" />
      <div className="text-center space-y-3">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-96 mx-auto" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="text-center pb-2">
              <Skeleton className="h-12 w-12 rounded-full mx-auto mb-2" />
              <Skeleton className="h-6 w-24 mx-auto" />
              <Skeleton className="h-8 w-32 mx-auto mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
              <Skeleton className="h-11 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  variant = "default",
  children,
}: {
  variant?: "default" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
    danger: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <div className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm ${variants[variant]}`}>
      {children}
    </div>
  );
}

function CurrentPlanCard({
  name,
  price,
  subscriptionEnd,
  canceling,
  loadingPortal,
  onManage,
}: {
  name: string;
  price: string;
  subscriptionEnd: string | null;
  canceling: boolean;
  loadingPortal: boolean;
  onManage: () => void;
}) {
  const { t } = useLanguage();
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-display font-semibold text-lg">{name}</p>
              <p className="text-sm text-muted-foreground">
                {price}/{t.app.upgrade.month}
                {subscriptionEnd && (
                  <> · {canceling ? t.app.upgrade.activeUntil : t.app.upgrade.renews} {new Date(subscriptionEnd).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canceling && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
                {t.app.upgrade.cancelNotice}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onManage} disabled={loadingPortal}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : t.app.upgrade.billingPortal}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PlanCard({
  tier,
  isCurrentPlan,
  subscribed,
  loadingTier,
  loadingPortal,
  onManage,
  index,
}: {
  tier: TierCard;
  isCurrentPlan: boolean;
  subscribed: boolean;
  loadingTier: boolean;
  loadingPortal: boolean;
  onManage: () => void;
  index: number;
}) {
  const { t } = useLanguage();
  const Icon = tier.icon;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={index + 2}>
      <Card
        className={`relative h-full flex flex-col transition-all duration-300 ${
          isCurrentPlan
            ? "border-primary ring-2 ring-primary/20 shadow-lg scale-[1.02]"
            : tier.popular && !isCurrentPlan
              ? "border-primary/50 shadow-md hover:shadow-lg hover:border-primary/70"
              : "hover:shadow-md hover:border-border/80"
        }`}
      >
        {isCurrentPlan && (
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground pointer-events-none">
            {t.app.upgrade.currentPlan}
          </Badge>
        )}
        {tier.popular && !isCurrentPlan && (
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground pointer-events-none">
            {t.app.upgrade.mostPopular}
          </Badge>
        )}
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-display text-xl">{tier.name}</CardTitle>
          <CardDescription>
            <span className="text-3xl font-bold text-foreground">{tier.price}</span>
            <span className="text-muted-foreground">{t.app.upgrade.perMonth}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex flex-col flex-1">
          <ul className="space-y-2.5 flex-1">
            {tier.features.map((feature) => {
              const isComingSoon = feature.includes("Coming Soon") || feature.includes("בקרוב");
              const label = isComingSoon
                ? feature.replace(/ — (Coming Soon|בקרוב)$/, "")
                : feature;
              return (
                <li key={feature} className={`flex items-start gap-2.5 text-sm ${isComingSoon ? "text-muted-foreground" : ""}`}>
                  <Check className={`h-4 w-4 mt-0.5 shrink-0 ${isComingSoon ? "text-muted-foreground/40" : "text-primary"}`} />
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {label}
                    {isComingSoon && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal leading-normal">
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
              {t.app.upgrade.currentPlan}
            </Button>
          ) : (
            <Button
              className="w-full min-h-[44px] bg-gradient-gold text-primary-foreground touch-manipulation"
              onClick={onManage}
              disabled={loadingTier || loadingPortal}
            >
              {loadingTier || loadingPortal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {subscribed
                ? t.app.upgrade.switchTo.replace("{name}", tier.name)
                : t.app.upgrade.subscribe.replace("{name}", tier.name)}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function UpgradePage() {
  const { t } = useLanguage();
  const { tenantId } = useTenantId();
  const {
    plan, tier, trialExpired, trialDaysLeft, trialActive,
    subscribed, subscriptionEnd, canceling, loading,
  } = useSubscription();
  const navigate = useNavigate();
  const { loadingTier, handleCheckout } = useCheckout();
  const { loadingPortal, handleManageOnStripe } = useCustomerPortal();

  const tierIcons: Partial<Record<keyof typeof SUBSCRIPTION_TIERS, typeof Crown>> = {
    lite: Zap,
    full: Crown,
  };

  const tierKeys = Object.keys(SUBSCRIPTION_TIERS) as Array<keyof typeof SUBSCRIPTION_TIERS>;

  const tiers: TierCard[] = tierKeys.map((key) => {
    const data = SUBSCRIPTION_TIERS[key];
    return {
      key,
      icon: tierIcons[key] ?? Crown,
      popular: ("popular" in data ? data.popular : false) as boolean,
      name: data.name,
      price: data.price,
      price_id: data.price_id,
      features: data.features,
    };
  });

  const currentTierData = tier && (tier in SUBSCRIPTION_TIERS)
    ? SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS]
    : null;
  const trialDays = getTrialDays();

  if (loading) {
    return <PlansSkeleton />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/settings")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.app.upgrade.backToSettings}
        </Button>
      </motion.div>

      <motion.div
        className="text-center space-y-2"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">
          {plan === "none"
            ? t.app.upgrade.titleInactive
            : subscribed
              ? t.app.upgrade.titleSubscribed
              : trialExpired
                ? t.app.upgrade.titleTrialEnded
                : t.app.upgrade.title}
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-balance">
          {plan === "none"
            ? t.app.upgrade.subtitleInactive
            : subscribed
              ? t.app.upgrade.subtitleSubscribed
              : trialExpired
                ? t.app.upgrade.subtitleTrialEnded
                : t.app.upgrade.subtitle}
        </p>
      </motion.div>

      {plan === "none" && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
          <StatusBadge variant="danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t.app.upgrade.inactiveBanner}</span>
          </StatusBadge>
        </motion.div>
      )}

      {trialActive && !subscribed && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
          <StatusBadge variant="warning">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {t.app.upgrade.trialBanner
                .replace("{days}", String(trialDaysLeft))}
            </span>
          </StatusBadge>
        </motion.div>
      )}

      {trialExpired && !subscribed && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
          <StatusBadge variant="danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t.app.upgrade.trialExpiredBanner}</span>
          </StatusBadge>
        </motion.div>
      )}

      {subscribed && currentTierData && (
        <>
          <CurrentPlanCard
            name={currentTierData.name}
            price={currentTierData.price}
            subscriptionEnd={subscriptionEnd}
            canceling={canceling}
            loadingPortal={loadingPortal}
            onManage={handleManageOnStripe}
          />
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
            <Separator />
          </motion.div>
        </>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {tiers.map((tierCard, index) => (
          <PlanCard
            key={tierCard.key}
            tier={tierCard}
            isCurrentPlan={subscribed && tier === tierCard.key}
            subscribed={subscribed}
            loadingTier={loadingTier === tierCard.key}
            loadingPortal={loadingPortal}
            onManage={subscribed ? handleManageOnStripe : () => handleCheckout(tierCard.price_id, tierCard.key)}
            index={index}
          />
        ))}
      </div>

      <motion.p
        className="text-center text-xs text-muted-foreground pt-2"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
      >
        {t.app.upgrade.footerNote.replace("{days}", String(trialDays))}
      </motion.p>
    </div>
  );
}
