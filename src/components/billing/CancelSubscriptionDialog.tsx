import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Gift, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "@/hooks/use-toast";

const REASONS = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using", label: "Not using it enough" },
  { value: "missing_features", label: "Missing features" },
  { value: "bugs", label: "Bugs / not working" },
  { value: "switching", label: "Switching to another tool" },
  { value: "temporary_pause", label: "Temporary pause" },
  { value: "other", label: "Other" },
];

type Step = "reason" | "offer" | "confirm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelSubscriptionDialog({ open, onOpenChange }: Props) {
  const { tenantId } = useTenantId();
  const { refreshSubscription } = useSubscription();
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [details, setDetails] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setStep("reason");
    setReason("");
    setOtherText("");
    setDetails("");
    setConfirmText("");
    setLoading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const reasonLabel = reason === "other" ? otherText : REASONS.find(r => r.value === reason)?.label || reason;

  const handleContinueFromReason = () => {
    // Show retention offer for all reasons
    setStep("offer");
  };

  const handleAcceptOffer = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { action: "apply_retention_offer", reason: reasonLabel, details: details || null, tenant_id: tenantId },
      });
      if (error) throw new Error(error.message || "Failed to apply discount");
      if (data?.error) throw new Error(data.error);
      toast({ title: "Discount applied! 🎉", description: "You'll get 50% off for the next 2 months." });
      await refreshSubscription();
      handleOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (confirmText !== "CANCEL") return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { action: "cancel", reason: reasonLabel, details: details || null, tenant_id: tenantId },
      });
      if (error) throw new Error(error.message || "Failed to cancel");
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Subscription canceled",
        description: data?.cancel_at
          ? `Your plan stays active until ${new Date(data.cancel_at).toLocaleDateString()}.`
          : "Your subscription has been canceled at the end of the current period.",
      });
      await refreshSubscription();
      handleOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {step === "reason" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Cancel Subscription
              </DialogTitle>
              <DialogDescription>
                We're sorry to see you go. Please tell us why you're canceling so we can improve.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                {REASONS.map((r) => (
                  <div key={r.value} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={r.value} id={r.value} />
                    <Label htmlFor={r.value} className="flex-1 cursor-pointer text-sm">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              {reason === "other" && (
                <Input
                  placeholder="Please specify..."
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  maxLength={200}
                />
              )}
              <div>
                <Label className="text-sm text-muted-foreground">Tell us more (optional)</Label>
                <Textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Any additional feedback..."
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <Button
                onClick={handleContinueFromReason}
                disabled={!reason || (reason === "other" && !otherText.trim())}
                variant="destructive"
                className="w-full"
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "offer" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Before you go…
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 text-center space-y-2">
                <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1">Special Offer</Badge>
                <p className="font-semibold text-lg">Stay with us — get 2 months at 50% off</p>
                <p className="text-sm text-muted-foreground">
                  We'd love to keep you. Accept this offer and your next 2 billing cycles will be half price.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleAcceptOffer} disabled={loading} className="bg-gradient-gold text-primary-foreground">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                  Accept Offer
                </Button>
                <Button variant="ghost" onClick={() => setStep("confirm")} disabled={loading} className="text-muted-foreground">
                  No thanks, continue to cancel
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Cancellation
              </DialogTitle>
              <DialogDescription>
                Your subscription will remain active until the end of your current billing period. After that, you'll lose access to paid features.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                Type <span className="font-mono font-bold">CANCEL</span> to confirm subscription cancellation.
              </div>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type CANCEL"
                className="font-mono"
                maxLength={10}
              />
              <Button
                onClick={handleConfirmCancel}
                disabled={confirmText !== "CANCEL" || loading}
                variant="destructive"
                className="w-full"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Cancel Subscription
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
