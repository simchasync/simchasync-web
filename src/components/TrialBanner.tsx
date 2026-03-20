import { useSubscription } from "@/contexts/SubscriptionContext";
import { AlertCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function TrialBanner() {
  const { plan, trialActive, trialDaysLeft, trialExpired, subscribed, loading } = useSubscription();
  const navigate = useNavigate();

  // Don't show any banner while loading
  if (loading || subscribed || plan !== "trial") return null;

  const handleViewPlans = () => {
    console.log("[TrialBanner] ViewPlansTapped");
    navigate("/app/upgrade");
  };

  if (trialExpired) {
    return (
      <div className="flex items-center justify-between bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <span className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          Your trial has ended. Choose a plan to continue.
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="min-h-[36px] min-w-[100px] touch-manipulation"
          onClick={handleViewPlans}
        >
          Upgrade Now
        </Button>
      </div>
    );
  }

  if (trialActive) {
    return (
      <div className="flex items-center justify-between bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your free trial
        </span>
        <Button
          size="sm"
          variant="outline"
          className="min-h-[36px] text-xs touch-manipulation"
          onClick={handleViewPlans}
        >
          View Plans
        </Button>
      </div>
    );
  }

  return null;
}
