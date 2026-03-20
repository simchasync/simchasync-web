import { useSubscription } from "@/contexts/SubscriptionContext";
import { Link } from "react-router-dom";
import { Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function TrialBanner() {
  const { trialActive, trialDaysLeft, trialExpired, subscribed } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || subscribed || (!trialActive && !trialExpired)) return null;

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm ${trialExpired ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4" />
        <span>
          {trialExpired
            ? "Your trial has expired. Upgrade to continue."
            : `${trialDaysLeft} days left in your trial.`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/upgrade">Upgrade</Link>
        </Button>
        {!trialExpired && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDismissed(true)}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
