import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Crown, CreditCard, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Link } from "react-router-dom";

const METHODS_ALL = ["cash", "check", "credit_card", "transfer", "zelle", "other"] as const;
const METHODS_NO_CC = ["cash", "check", "transfer", "zelle", "other"] as const;

interface Props {
  eventId: string;
  canWrite: boolean;
  invoiceId?: string; // optional: if linked to an invoice, credit card charges go through it
}

export default function PaymentsSection({ eventId, canWrite, invoiceId }: Props) {
  const qc = useQueryClient();
  const { canAccess } = useSubscription();
  const canUseStripe = canAccess("stripe_connect");
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [stripeProcessing, setStripeProcessing] = useState(false);

  const { data: payments = [] } = useQuery({
    queryKey: ["event_payments", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_payments")
        .select("*")
        .eq("event_id", eventId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      // Credit card flow - needs an invoice
      if (method === "credit_card") {
        if (!invoiceId) {
          throw new Error("Create an invoice first to collect credit card payments");
        }
        setStripeProcessing(true);
        try {
          const { data, error } = await supabase.functions.invoke("create-invoice-payment", {
            body: { invoice_id: invoiceId, amount: Number(amount) },
          });
          if (error) throw error;
          if (data?.url) {
            window.location.href = data.url;
            return;
          }
          throw new Error("Failed to create payment link");
        } finally {
          setStripeProcessing(false);
        }
      }
      const { error } = await supabase.from("event_payments").insert({
        event_id: eventId,
        amount: Number(amount),
        payment_date: date,
        method,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (method === "credit_card") return;
      qc.invalidateQueries({ queryKey: ["event_payments", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setAdding(false);
      setAmount(""); setNotes("");
      toast({ title: "Payment recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_payments", eventId] });
      toast({ title: "Payment removed" });
    },
  });

  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const methods = canUseStripe ? METHODS_ALL : METHODS_NO_CC;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Payments (Total: ${totalPaid.toLocaleString()})</h4>
        {canWrite && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add Payment
          </Button>
        )}
      </div>

      {adding && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3 bg-muted/30">
          <div>
            <Label className="text-xs">Amount *</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m === "credit_card" ? "💳 Credit Card (Stripe)" : m.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {method === "credit_card" && (
            <div className="col-span-1 sm:col-span-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary shrink-0" />
              This will redirect the payer to Stripe Checkout. Payment is recorded automatically.
            </div>
          )}
          {!canUseStripe && (
            <div className="col-span-1 sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Credit card payments require the <Link to="/app/upgrade" className="font-semibold text-primary underline">Full Platform plan</Link>.</span>
            </div>
          )}
          <div className="col-span-1 sm:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="button" size="sm" disabled={!amount || addMutation.isPending || stripeProcessing} onClick={() => addMutation.mutate()} className="bg-gradient-gold text-primary-foreground">
              {stripeProcessing ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Redirecting...</> : method === "credit_card" ? "Charge via Stripe" : addMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Notes</TableHead>
              {canWrite && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">{format(new Date(p.payment_date), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-sm capitalize">{p.method?.replace("_", " ")}</TableCell>
                <TableCell className="text-right font-medium">${Number(p.amount).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.notes ?? "—"}</TableCell>
                {canWrite && (
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
