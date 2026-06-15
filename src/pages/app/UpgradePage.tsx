import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { SUBSCRIPTION_TIERS, getTrialDays } from "@/lib/subscription-tiers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check, Crown, Zap, Gem, ExternalLink, ArrowLeft,
  Clock, AlertCircle, Loader2, ShieldCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useTenantId } from "@/hooks/useTenantId";

// ─── Types ────────────────────────────────────────────────────────────────────

type TierKey = keyof typeof SUBSCRIPTION_TIERS;

interface TierCard {
  key: TierKey;
  icon: typeof Crown;
  popular: boolean;
  name: string;
  price: string;
  tagline: string;
  price_id: string;
  features: readonly string[];
}

// ─── Animation constants ──────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: EASE },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.07, duration: 0.45, ease: EASE },
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An unexpected error occurred.";
}

function parseComingSoon(feature: string) {
  const isComingSoon = feature.includes("Coming Soon") || feature.includes("בקרוב");
  const label = isComingSoon
    ? feature.replace(/ — (Coming Soon|בקרוב)$/, "")
    : feature;
  return { label, isComingSoon };
}

// ─── Custom hooks ─────────────────────────────────────────────────────────────

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
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
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
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoadingPortal(false);
    }
  };

  return { loadingPortal, handleManageOnStripe };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlansSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <Skeleton className="h-8 w-28" />
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-80" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-9 w-24" />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                </div>
              ))}
              <Skeleton className="h-10 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type StatusVariant = "warning" | "danger" | "info";

const statusStyles: Record<StatusVariant, string> = {
  warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  danger: "bg-destructive/5 border-destructive/20 text-destructive",
  info: "bg-primary/5 border-primary/20 text-primary",
};

function StatusBanner({
  variant,
  icon: Icon,
  children,
}: {
  variant: StatusVariant;
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${statusStyles[variant]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </motion.div>
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

  const renewLabel = subscriptionEnd
    ? `${canceling ? t.app.upgrade.activeUntil : t.app.upgrade.renews} ${new Date(subscriptionEnd).toLocaleDateString()}`
    : null;

  return (
    <motion.div variants={scaleIn}>
      <Card className="border-border/60 bg-card">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">{name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {price}/{t.app.upgrade.month}
                {renewLabel && <> · {renewLabel}</>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canceling && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                {t.app.upgrade.cancelNotice}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onManage}
              disabled={loadingPortal}
              className="h-8 gap-1.5 text-xs"
            >
              {loadingPortal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              {t.app.upgrade.billingPortal}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FeatureItem({ feature }: { feature: string }) {
  const { label, isComingSoon } = parseComingSoon(feature);
  return (
    <li className={`flex items-start gap-2.5 text-sm ${isComingSoon ? "text-muted-foreground/60" : "text-foreground/80"}`}>
      <Check
        className={`mt-0.5 h-4 w-4 shrink-0 ${isComingSoon ? "text-muted-foreground/30" : "text-primary"}`}
      />
      <span className="flex flex-wrap items-center gap-1.5 leading-snug">
        {label}
        {isComingSoon && (
          <Badge
            variant="outline"
            className="h-4 border-border/40 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
          >
            Soon
          </Badge>
        )}
      </span>
    </li>
  );
}

function PlanCard({
  tier,
  isCurrentPlan,
  loadingTier,
  loadingPortal,
  onAction,
}: {
  tier: TierCard;
  isCurrentPlan: boolean;
  loadingTier: boolean;
  loadingPortal: boolean;
  onAction: () => void;
}) {
  const { t } = useLanguage();
  const Icon = tier.icon;
  const busy = loadingTier || loadingPortal;
  // No Stripe price yet (e.g. Premium until its Stripe product is created)
  const notPurchasable = !tier.price_id && !isCurrentPlan;

  const ctaLabel = isCurrentPlan
    ? t.app.upgrade.currentPlan
    : notPurchasable
      ? "Coming Soon"
      : tier.key === "lite"
        ? t.app.upgrade.switchTo.replace("{name}", tier.name)
        : t.app.upgrade.subscribe.replace("{name}", tier.name);

  return (
    <motion.div
      variants={scaleIn}
      custom={tier.key === "full" ? 1 : 0}
      className="flex"
      whileHover={isCurrentPlan ? {} : { y: -2, transition: { duration: 0.2 } }}
    >
      <Card
        className={[
          "relative flex h-full w-full flex-col transition-shadow duration-300",
          isCurrentPlan
            ? "border-primary/50 shadow-sm ring-1 ring-primary/15"
            : tier.popular
              ? "border-primary/40 shadow-md hover:border-primary/60 hover:shadow-lg"
              : tier.key === "premium"
                ? "border-violet-300/50 bg-gradient-to-b from-violet-500/[0.05] to-transparent hover:border-violet-400/60 hover:shadow-md dark:border-violet-700/50"
                : "border-border/60 hover:shadow-sm",
        ].join(" ")}
      >
        {/* Top badge */}
        <AnimatePresence>
          {(isCurrentPlan || (tier.popular && !isCurrentPlan)) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute -top-3 left-1/2 -translate-x-1/2"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
                {isCurrentPlan ? (
                  <><Check className="h-3 w-3" />{t.app.upgrade.currentPlan}</>
                ) : (
                  t.app.upgrade.mostPopular
                )}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <CardContent className="flex flex-1 flex-col p-6">
          {/* Icon + name + tagline */}
          <div className="mb-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 transition-colors group-hover:border-primary/20 group-hover:bg-primary/5">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-base font-semibold">{tier.name}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tier.tagline}</p>
          </div>

          {/* Price */}
          <div className="mb-5 border-b border-border/50 pb-5">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                {tier.price}
              </span>
              <span className="text-sm text-muted-foreground">{t.app.upgrade.perMonth}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">{t.app.upgrade.billedMonthly}</p>
          </div>

          {/* Features */}
          <ul className="mb-6 flex flex-1 flex-col gap-2.5">
            {tier.features.map((feature) => (
              <FeatureItem key={feature} feature={feature} />
            ))}
          </ul>

          {/* CTA */}
          <Button
            onClick={isCurrentPlan || notPurchasable ? undefined : onAction}
            disabled={isCurrentPlan || busy || notPurchasable}
            variant={isCurrentPlan ? "outline" : "default"}
            className={[
              "w-full gap-2 font-semibold",
              !isCurrentPlan && !busy
                ? "transition-all hover:translate-y-[-1px] hover:shadow-md"
                : "",
            ].join(" ")}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCurrentPlan && !busy && <Check className="h-4 w-4" />}
            {ctaLabel}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Page heading ─────────────────────────────────────────────────────────────

function PageHeading({
  plan,
  subscribed,
  trialExpired,
}: {
  plan: string;
  subscribed: boolean;
  trialExpired: boolean;
}) {
  const { t } = useLanguage();

  const title =
    plan === "none"
      ? t.app.upgrade.titleInactive
      : subscribed
        ? t.app.upgrade.titleSubscribed
        : trialExpired
          ? t.app.upgrade.titleTrialEnded
          : t.app.upgrade.title;

  const subtitle =
    plan === "none"
      ? t.app.upgrade.subtitleInactive
      : subscribed
        ? t.app.upgrade.subtitleSubscribed
        : trialExpired
          ? t.app.upgrade.subtitleTrialEnded
          : t.app.upgrade.subtitle;

  return (
    <motion.div variants={fadeUp} custom={1} className="text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground text-balance">
        {subtitle}
      </p>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UpgradePage() {
  const { t } = useLanguage();
  const {
    plan, tier, trialExpired, trialDaysLeft, trialActive,
    subscribed, subscriptionEnd, canceling, loading,
  } = useSubscription();
  const navigate = useNavigate();
  const { loadingTier, handleCheckout } = useCheckout();
  const { loadingPortal, handleManageOnStripe } = useCustomerPortal();

  const tiers: TierCard[] = [
    { ...SUBSCRIPTION_TIERS.lite,    key: "lite",    icon: Zap,   popular: false },
    { ...SUBSCRIPTION_TIERS.full,    key: "full",    icon: Crown, popular: true },
    { ...SUBSCRIPTION_TIERS.premium, key: "premium", icon: Gem,   popular: false },
  ];

  const currentTierData = tier && tier !== "trial" ? SUBSCRIPTION_TIERS[tier] : null;
  const trialDays = getTrialDays();

  if (loading) return <PlansSkeleton />;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
      className="mx-auto max-w-5xl space-y-6 p-4 md:p-8"
    >
      {/* Back button */}
      <motion.div variants={fadeUp} custom={0}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/settings")}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.app.upgrade.backToSettings}
        </Button>
      </motion.div>

      {/* Heading */}
      <PageHeading plan={plan} subscribed={subscribed} trialExpired={trialExpired} />

      {/* Status banners */}
      <AnimatePresence mode="wait">
        {plan === "none" && (
          <StatusBanner key="inactive" variant="danger" icon={AlertCircle}>
            {t.app.upgrade.inactiveBanner}
          </StatusBanner>
        )}
        {trialActive && !subscribed && (
          <StatusBanner key="trial" variant="warning" icon={Clock}>
            {t.app.upgrade.trialBanner.replace("{days}", String(trialDaysLeft))}
          </StatusBanner>
        )}
        {trialExpired && !subscribed && (
          <StatusBanner key="expired" variant="danger" icon={AlertCircle}>
            {t.app.upgrade.trialExpiredBanner}
          </StatusBanner>
        )}
      </AnimatePresence>

      {/* Current plan card */}
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
          <motion.hr
            variants={fadeUp}
            className="border-t border-border/50"
          />
        </>
      )}

      {/* Plan cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((tierCard) => (
          <PlanCard
            key={tierCard.key}
            tier={tierCard}
            isCurrentPlan={subscribed && tier === tierCard.key}
            loadingTier={loadingTier === tierCard.key}
            loadingPortal={loadingPortal}
            onAction={
              subscribed
                ? handleManageOnStripe
                : () => handleCheckout(tierCard.price_id, tierCard.key)
            }
          />
        ))}
      </div>

      {/* Trust bar */}
      <motion.div
        variants={fadeUp}
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-xs text-muted-foreground"
      >
        {[
          t.app.upgrade.trustTrial.replace("{days}", String(trialDays)),
          t.app.upgrade.trustNoFees,
          t.app.upgrade.trustCancel,
          t.app.upgrade.trustSecure,
        ].map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            {item}
          </span>
        ))}
      </motion.div>

      {/* Footer note */}
      <motion.p
        variants={fadeUp}
        className="pb-2 text-center text-xs text-muted-foreground"
      >
        {t.app.upgrade.footerNote.replace("{days}", String(trialDays))}
      </motion.p>
    </motion.div>
  );
}