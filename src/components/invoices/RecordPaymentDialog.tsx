import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Crown, CreditCard, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
}

const METHODS_ALL = ["cash", "check", "bank_transfer", "credit_card", "zelle", "other"];
const METHODS_NO_CC = ["cash", "check", "bank_transfer", "zelle", "other"];

export default function RecordPaymentDialog({ open, onOpenChange, invoice }: RecordPaymentDialogProps) {
  const qc = useQueryClient();
  const { canAccess } = useSubscription();
  const canUseStripe = canAccess("stripe_connect");
  const [amount, setAmount] = useState(String(invoice?.amount || ""));
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [stripeProcessing, setStripeProcessing] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }

    // If credit card, redirect to Stripe Checkout
    if (method === "credit_card") {
      setStripeProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-invoice-payment", {
          body: { invoice_id: invoice.id, amount: Number(amount) },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error("Failed to create payment link");
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setStripeProcessing(false);
      }
      return;
    }

    setSaving(true);
    try {
      // If invoice is linked to an event, create event_payment linked to both
      if (invoice.event_id) {
        const { error: epErr } = await supabase.from("event_payments").insert({
          event_id: invoice.event_id,
          invoice_id: invoice.id,
          amount: Number(amount),
          method,
          notes: notes || null,
          payment_date: date,
        });
        if (epErr) throw epErr;
      }

      // Update invoice status to paid
      const { error: invErr } = await supabase.from("invoices").update({
        status: "paid" as any,
      }).eq("id", invoice.id);
      if (invErr) throw invErr;

      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-payments"] });
      toast({ title: "Payment recorded" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const methods = canUseStripe ? METHODS_ALL : METHODS_NO_CC;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a manual payment for this invoice{invoice?.clients?.name ? ` from ${invoice.clients.name}` : ""}.
            {invoice?.event_id && " This will also be linked to the associated event."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m === "credit_card" ? "💳 Credit Card (Stripe)" : m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {method === "credit_card" && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary shrink-0" />
              This will redirect the payer to Stripe Checkout. Payment will be recorded automatically after successful charge.
            </div>
          )}
          {!canUseStripe && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Credit card payments require the <Link to="/app/upgrade" className="font-semibold text-primary underline">Full Platform plan</Link>.</span>
            </div>
          )}
          {method !== "credit_card" && (
            <>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || stripeProcessing} className="bg-gradient-gold text-primary-foreground font-semibold">
            {stripeProcessing ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Redirecting...</> : method === "credit_card" ? "Charge via Stripe" : saving ? "Saving..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
