import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/hooks/useTenantId";
import { supabase } from "@/integrations/supabase/client";
import { getTierFromProductId, SubscriptionTier, canAccessFeature } from "@/lib/subscription-tiers";

const db = supabase as any;

interface SubscriptionContextType {
  plan: string;
  tier: SubscriptionTier;
  subscribed: boolean;
  subscriptionEnd: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  trialActive: boolean;
  trialExpired: boolean;
  canceling: boolean;
  loading: boolean;
  workspaceActive: boolean;
  canAccess: (feature: "stripe_connect" | "social_media" | "expenses_profit") => boolean;
  refreshSubscription: () => Promise<void>;
  pollUntilSubscribed: (maxAttempts?: number, intervalMs?: number) => Promise<boolean | undefined>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenantId();
  const [plan, setPlan] = useState("trial");
  const [tier, setTier] = useState<SubscriptionTier>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [tenantFetched, setTenantFetched] = useState(false);

  const dbSubscriptionActive = useRef(false);

  const loading = authLoading || (!!user && tenantLoading) || (!!user && !!tenantId && !tenantFetched);

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 30;

  const trialActive = plan === "trial" && (trialEndsAt !== null ? trialDaysLeft > 0 : !tenantFetched);
  const trialExpired = plan === "trial" && tenantFetched && trialEndsAt !== null && trialDaysLeft <= 0;

  const refreshSubscription = useCallback(async () => {
    if (!session?.access_token || !tenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        body: { tenant_id: tenantId },
      });
      if (!error && data) {
        if (data.subscribed) {
          const detectedTier = getTierFromProductId(data.product_id, data.price_id);
          if (data.status === "trial" || data.plan_id === "trial") return;
          if (detectedTier) {
            setSubscribed(true);
            setSubscriptionEnd(data.subscription_end);
            setTier(detectedTier);
            setPlan(detectedTier);
          } else if (data.plan_id && data.plan_id !== "none") {
            setSubscribed(true);
            setSubscriptionEnd(data.subscription_end);
            setTier(data.plan_id as SubscriptionTier);
            setPlan(data.plan_id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to check subscription:", e);
    }
  }, [session?.access_token, tenantId]);

  const pollUntilSubscribed = useCallback(async (maxAttempts = 10, intervalMs = 3000) => {
    if (!session?.access_token || !tenantId) return;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription", {
          body: { tenant_id: tenantId },
        });
        if (!error && data?.subscribed) {
          setSubscribed(true);
          setSubscriptionEnd(data.subscription_end);
          const detectedTier = getTierFromProductId(data.product_id, data.price_id);
          setTier(detectedTier);
          if (detectedTier) setPlan(detectedTier);
          if (tenantId) {
            const { data: tenantData } = await db
              .from("tenants")
              .select("plan, trial_ends_at")
              .eq("id", tenantId)
              .single();
            if (tenantData && tenantData.plan !== "trial") {
              setPlan(tenantData.plan);
            }
          }
          return true;
        }
      } catch (e) {
        console.error("Poll attempt failed:", e);
      }
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
    return false;
  }, [session?.access_token, tenantId]);

  const fetchTenantData = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await db
      .from("tenants")
      .select("plan, trial_ends_at, stripe_subscription_status, stripe_plan_price_id, stripe_current_period_end")
      .eq("id", tenantId)
      .single();

    if (data) {
      setPlan(data.plan);
      setTrialEndsAt(data.trial_ends_at);
      setCanceling(data.stripe_subscription_status === "canceling");

      if (data.plan === "none") {
        setSubscribed(false);
        setTier(null);
        dbSubscriptionActive.current = false;
        setTenantFetched(true);
        return;
      }

      const isActiveFromDB = data.stripe_subscription_status === "active" && data.plan !== "trial";
      dbSubscriptionActive.current = isActiveFromDB;

      if (isActiveFromDB) {
        setSubscribed(true);
        setTier(data.plan as SubscriptionTier);
        if (data.stripe_current_period_end) {
          setSubscriptionEnd(data.stripe_current_period_end);
        }
      } else if (data.plan === "trial") {
        setSubscribed(false);
        setTier(null);
        dbSubscriptionActive.current = false;
      } else if (data.stripe_subscription_status === "canceled" || data.stripe_subscription_status === "past_due") {
        setSubscribed(false);
        setCanceling(data.stripe_subscription_status === "canceled");
        dbSubscriptionActive.current = false;
      }
    }
    setTenantFetched(true);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    fetchTenantData();
  }, [tenantId, fetchTenantData]);

  useEffect(() => {
    if (session?.access_token && tenantId && tenantFetched) {
      refreshSubscription();
    }
  }, [session?.access_token, tenantId, tenantFetched, refreshSubscription]);

  useEffect(() => {
    if (!session?.access_token || !tenantId) return;
    const interval = setInterval(() => {
      fetchTenantData();
      refreshSubscription();
    }, 60000);
    return () => clearInterval(interval);
  }, [session?.access_token, tenantId, refreshSubscription, fetchTenantData]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`tenant-sub-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenantId}`,
        },
        (payload: any) => {
          const newData = payload.new as any;
          if (newData) {
            setPlan(newData.plan);
            setTrialEndsAt(newData.trial_ends_at);
            setCanceling(newData.stripe_subscription_status === "canceling");
            const isActive = newData.stripe_subscription_status === "active" && newData.plan !== "trial";
            dbSubscriptionActive.current = isActive;
            if (isActive) {
              setSubscribed(true);
              setTier(newData.plan as SubscriptionTier);
              if (newData.stripe_current_period_end) {
                setSubscriptionEnd(newData.stripe_current_period_end);
              }
            } else if (newData.plan === "trial") {
              setSubscribed(false);
              setTier(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const canAccess = (feature: "stripe_connect" | "social_media" | "expenses_profit") =>
    canAccessFeature(plan, tier, trialActive, feature);

  const workspaceActive = plan !== "none" && (subscribed || trialActive);

  return (
    <SubscriptionContext.Provider
      value={{
        plan, tier, subscribed, subscriptionEnd,
        trialEndsAt, trialDaysLeft, trialActive, trialExpired,
        canceling, loading, workspaceActive, canAccess, refreshSubscription, pollUntilSubscribed,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
