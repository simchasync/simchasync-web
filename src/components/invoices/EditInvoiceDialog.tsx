import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Check, X, Crown, CreditCard, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Link } from "react-router-dom";


const METHODS_ALL = ["cash", "check", "credit_card", "transfer", "zelle", "other"] as const;
const METHODS_NO_CC = ["cash", "check", "transfer", "zelle", "other"] as const;
const STATUSES = ["draft", "sent", "paid", "overdue"] as const;

interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  clients: any[];
  events: any[];
  onSaved: () => void;
}

export default function EditInvoiceDialog({ open, onOpenChange, invoice, clients, events, onSaved }: EditInvoiceDialogProps) {
  const { t } = useLanguage();
  const { canAccess } = useSubscription();
  const canUseStripe = canAccess("stripe_connect");
  const inv = t.app.invoices;
  const qc = useQueryClient();

  // Invoice form state
  const [amount, setAmount] = useState("");
  const [overtime, setOvertime] = useState("");
  const [clientId, setClientId] = useState("");
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("draft");

  // Payment add form
  const [adding, setAdding] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [stripeProcessing, setStripeProcessing] = useState(false);

  // Inline edit state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPayAmount, setEditPayAmount] = useState("");
  const [editPayDate, setEditPayDate] = useState("");
  const [editPayMethod, setEditPayMethod] = useState("");
  const [editPayNotes, setEditPayNotes] = useState("");

  useEffect(() => {
    if (invoice) {
      setAmount(String(invoice.amount ?? 0));
      setOvertime(String((invoice as any).overtime ?? 0));
      setClientId(invoice.client_id ?? "");
      setEventId(invoice.event_id ?? "");
      setStatus(invoice.status ?? "draft");
    }
  }, [invoice]);

  const effectiveEventId = eventId || invoice?.event_id;

  const { data: payments = [] } = useQuery({
    queryKey: ["event_payments", effectiveEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_payments")
        .select("*")
        .eq("event_id", effectiveEventId!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveEventId && open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        client_id: clientId || null,
        event_id: eventId || null,
        amount: Number(amount) || 0,
        overtime: Number(overtime) || 0,
        status,
        sent_at: status === "sent" && !invoice?.sent_at ? new Date().toISOString() : invoice?.sent_at ?? null,
      };
      const { error } = await supabase.from("invoices").update(payload).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onSaved();
      onOpenChange(false);
      toast({ title: "Invoice updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      // If credit card, redirect to Stripe Checkout instead of recording directly
      if (payMethod === "credit_card") {
        setStripeProcessing(true);
        try {
          const { data, error } = await supabase.functions.invoke("create-invoice-payment", {
            body: { invoice_id: invoice.id, amount: Number(payAmount) },
          });
          if (error) throw error;
          if (data?.url) {
            window.location.href = data.url;
            return; // Don't record payment - webhook will do it
          }
          throw new Error("Failed to create payment link");
        } finally {
          setStripeProcessing(false);
        }
      }
      // For non-credit-card methods, record directly
      const { error } = await supabase.from("event_payments").insert({
        event_id: effectiveEventId!,
        amount: Number(payAmount),
        payment_date: payDate,
        method: payMethod,
        notes: payNotes || null,
        invoice_id: invoice.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (payMethod === "credit_card") return; // Redirected to Stripe
      qc.invalidateQueries({ queryKey: ["event_payments", effectiveEventId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setAdding(false);
      setPayAmount(""); setPayNotes("");
      toast({ title: "Payment recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_payments").update({
        amount: Number(editPayAmount),
        payment_date: editPayDate,
        method: editPayMethod,
        notes: editPayNotes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_payments", effectiveEventId] });
      setEditingPaymentId(null);
      toast({ title: "Payment updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_payments", effectiveEventId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Payment removed" });
    },
  });

  const startEditPayment = (p: any) => {
    setEditingPaymentId(p.id);
    setEditPayAmount(String(p.amount));
    setEditPayDate(p.payment_date);
    setEditPayMethod(p.method);
    setEditPayNotes(p.notes ?? "");
  };

  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const contractTotal = (Number(amount) || 0) + (Number(overtime) || 0);
  const balanceDue = contractTotal - totalPaid;

  const bookingsLabel = (ev: any) =>
    ev ? `${ev.event_type} — ${format(new Date(ev.event_date), "MMM d, yyyy")}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.common.edit} {inv.title.toLowerCase()}</DialogTitle>
          <DialogDescription>Full contract view with payments</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{inv.amount} (Contract) *</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Overtime</Label>
              <Input type="number" min="0" step="0.01" value={overtime} onChange={(e) => setOvertime(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{t.app.bookings.client}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((cl: any) => (
                    <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map((ev: any) => (
                    <SelectItem key={ev.id} value={ev.id}>{bookingsLabel(ev)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{inv.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{(inv.statuses as any)[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Contract Amount</span>
              <span className="font-medium">${Number(amount || 0).toLocaleString()}</span>
            </div>
            {Number(overtime) > 0 && (
              <div className="flex justify-between text-sm">
                <span>Overtime</span>
                <span className="font-medium">${Number(overtime).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Total Paid</span>
              <span className="font-medium text-emerald-600">${totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
              <span>Balance Due</span>
              <span className={balanceDue > 0 ? "text-destructive" : "text-emerald-600"}>${balanceDue.toLocaleString()}</span>
            </div>
          </div>

          {/* Payments Section */}
          {effectiveEventId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Payments</h4>
                {!adding && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
                    <Plus className="mr-1 h-3 w-3" /> Add Payment
                  </Button>
                )}
              </div>

              {adding && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3 bg-muted/30">
                  <div>
                    <Label className="text-xs">Amount *</Label>
                    <Input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Method</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(canUseStripe ? METHODS_ALL : METHODS_NO_CC).map((m) => <SelectItem key={m} value={m}>{m === "credit_card" ? "💳 Credit Card (Stripe)" : m.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
                  </div>
                  {payMethod === "credit_card" && (
                    <div className="sm:col-span-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary shrink-0" />
                      Clicking "Charge via Stripe" will redirect the payer to a Stripe Checkout page. The payment will be recorded automatically after successful charge.
                    </div>
                  )}
                  {!canUseStripe && (
                    <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Credit card payments require the <Link to="/app/upgrade" className="font-semibold text-primary underline">Full Platform plan</Link>.</span>
                    </div>
                  )}
                  <div className="sm:col-span-2 flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                    <Button type="button" size="sm" disabled={!payAmount || addPaymentMutation.isPending || stripeProcessing} onClick={() => addPaymentMutation.mutate()} className="bg-gradient-gold text-primary-foreground">
                      {stripeProcessing ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Redirecting...</> : payMethod === "credit_card" ? "Charge via Stripe" : addPaymentMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Desktop Table */}
              {payments.length > 0 && (
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p: any) => (
                        <TableRow key={p.id}>
                          {editingPaymentId === p.id ? (
                            <>
                              <TableCell><Input type="date" value={editPayDate} onChange={(e) => setEditPayDate(e.target.value)} className="h-8 text-xs" /></TableCell>
                              <TableCell>
                                <Select value={editPayMethod} onValueChange={setEditPayMethod}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {METHODS_ALL.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell><Input type="number" min="0" step="0.01" value={editPayAmount} onChange={(e) => setEditPayAmount(e.target.value)} className="h-8 text-xs text-right" /></TableCell>
                              <TableCell><Input value={editPayNotes} onChange={(e) => setEditPayNotes(e.target.value)} className="h-8 text-xs" /></TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => updatePaymentMutation.mutate(p.id)}>
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPaymentId(null)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-sm">{format(new Date(p.payment_date), "MMM d, yyyy")}</TableCell>
                              <TableCell className="text-sm capitalize">{p.method?.replace("_", " ")}</TableCell>
                              <TableCell className="text-right font-medium">${Number(p.amount).toLocaleString()}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{p.notes ?? "—"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditPayment(p)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePaymentMutation.mutate(p.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Mobile Cards */}
              {payments.length > 0 && (
                <div className="space-y-2 sm:hidden">
                  {payments.map((p: any) => (
                    <div key={p.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      {editingPaymentId === p.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Date</Label>
                              <Input type="date" value={editPayDate} onChange={(e) => setEditPayDate(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-xs">Amount</Label>
                              <Input type="number" min="0" step="0.01" value={editPayAmount} onChange={(e) => setEditPayAmount(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-xs">Method</Label>
                              <Select value={editPayMethod} onValueChange={setEditPayMethod}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {METHODS_ALL.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Notes</Label>
                              <Input value={editPayNotes} onChange={(e) => setEditPayNotes(e.target.value)} className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="flex gap-1 justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPaymentId(null)}>
                              <X className="h-3.5 w-3.5 mr-1" /> Cancel
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => updatePaymentMutation.mutate(p.id)}>
                              <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">${Number(p.amount).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(p.payment_date), "MMM d, yyyy")} · <span className="capitalize">{p.method?.replace("_", " ")}</span></p>
                            </div>
                            <div className="flex gap-1">
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditPayment(p)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePaymentMutation.mutate(p.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {payments.length === 0 && !adding && (
                <p className="text-sm text-muted-foreground text-center py-3">No payments recorded yet</p>
              )}
            </div>
          )}

          {!effectiveEventId && (
            <p className="text-sm text-muted-foreground">Link an event to manage payments</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()} className="bg-gradient-gold text-primary-foreground font-semibold">
            {saveMutation.isPending ? t.common.loading : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
