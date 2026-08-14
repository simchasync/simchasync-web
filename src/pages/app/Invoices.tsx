import { useState, useRef, useEffect, useMemo } from "react";
import { CardListSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { StatCard, SectionHeader } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Pencil, Trash2, Link2, Copy, Eye, Send, DollarSign, Printer, Wallet, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";
import { INVOICE_STATUSES } from "@/lib/invoiceStatuses";
import InvoicePreview from "@/components/invoices/InvoicePreview";
import SendInvoiceDialog from "@/components/invoices/SendInvoiceDialog";
import RecordPaymentDialog from "@/components/invoices/RecordPaymentDialog";
import EditInvoiceDialog from "@/components/invoices/EditInvoiceDialog";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";
import { useSearchParams } from "react-router-dom";

type Invoice = Tables<"invoices">;

const STATUSES = INVOICE_STATUSES;

const emptyForm = { client_id: "", event_id: "", amount: "", status: "draft" as string };

export default function Invoices() {
  const { t } = useLanguage();
  const inv = t.app.invoices;
  const { tenantId } = useTenantId();
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);

  // Preview / Send / Payment states
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendInvoice, setSendInvoice] = useState<any>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [previewPayments, setPreviewPayments] = useState<any[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(name, email, phone), events(event_type, event_date)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, event_type, event_date").eq("tenant_id", tenantId!).order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("stripe_connect_onboarded, name, payment_instructions").eq("id", tenantId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const stripeConnected = tenant?.stripe_connect_onboarded === true;

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        client_id: values.client_id || null,
        event_id: values.event_id || null,
        amount: Number(values.amount) || 0,
        status: values.status as Invoice["status"],
        sent_at: values.status === "sent" ? (editing?.sent_at ?? new Date().toISOString()) : editing?.sent_at ?? null,
      };

      if (editing) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      closeDialog();
      toast({ title: editing ? "Invoice updated" : "Invoice created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePaymentLink = async (invoiceId: string, existingUrl?: string | null) => {
    if (existingUrl) {
      navigator.clipboard.writeText(existingUrl);
      toast({ title: inv.linkCopied });
      return;
    }

    if (!stripeConnected) {
      toast({ title: inv.noStripe, variant: "destructive" });
      return;
    }

    setGeneratingLink(invoiceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-invoice-payment", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.url) {
        navigator.clipboard.writeText(data.url);
        toast({ title: inv.linkCopied });
        qc.invalidateQueries({ queryKey: ["invoices"] });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingLink(null);
    }
  };

  const handlePrint = () => {
    const content = previewRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    // Carry the app's stylesheets so the printed/downloaded invoice renders with
    // the same Tailwind styling as the modal preview (outerHTML keeps the root
    // element's classes too).
    const appStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join("\n");
    win.document.write(`
      <html><head><title>Invoice</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
      ${appStyles}
      <style>
        body { padding: 20px; background: #fff; margin: 0; }
        @media print { body { padding: 0; } }
      </style></head><body>${content.outerHTML}</body></html>
    `);
    win.document.close();
    // Give the copied stylesheets a moment to load before printing.
    setTimeout(() => { win.focus(); win.print(); }, 700);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (i: Invoice) => {
    setEditing(i);
    setForm({ client_id: i.client_id ?? "", event_id: i.event_id ?? "", amount: String(i.amount), status: i.status });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const statusColor = (s: string) => {
    switch (s) {
      case "paid": return "bg-emerald-500/15 text-emerald-700 border-emerald-200";
      case "sent": return "bg-blue-500/15 text-blue-700 border-blue-200";
      case "overdue": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const bookingsLabel = (ev: any) =>
    ev ? `${ev.event_type} — ${format(new Date(ev.event_date), "MMM d, yyyy")}` : "";

  const filteredInvoices = statusFilter === "all"
    ? invoices
    : invoices.filter((i: any) => {
        if (statusFilter === "unpaid") return i.status === "draft" || i.status === "overdue";
        if (statusFilter === "pending") return i.status === "sent";
        return i.status === statusFilter;
      });

  const filterCounts = {
    all: invoices.length,
    paid: invoices.filter((i: any) => i.status === "paid").length,
    unpaid: invoices.filter((i: any) => i.status === "draft" || i.status === "overdue").length,
    pending: invoices.filter((i: any) => i.status === "sent").length,
  };

  const stats = useMemo(() => {
    const sum = (items: any[]) => items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const paid = invoices.filter((i: any) => i.status === "paid");
    const pending = invoices.filter((i: any) => i.status === "sent");
    const unpaid = invoices.filter((i: any) => i.status === "draft" || i.status === "overdue");
    return {
      totalSum: sum(invoices),
      paidSum: sum(paid),
      paidCount: paid.length,
      pendingSum: sum(pending),
      unpaidSum: sum(unpaid),
      unpaidCount: unpaid.length,
    };
  }, [invoices]);

  useEffect(() => {
    const invoiceId = searchParams.get("invoice");
    const eventId = searchParams.get("event");
    if (!invoiceId && !eventId) return;

    const matchedInvoice = invoiceId
      ? invoices.find((inv: any) => inv.id === invoiceId)
      : invoices.find((inv: any) => inv.event_id === eventId);

    if (!matchedInvoice) return;
    setEditing(matchedInvoice);
    setSearchParams({}, { replace: true });
  }, [searchParams, invoices, setSearchParams]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">{inv.title}</h1>
        {canWrite && (
          <Button onClick={openNew} className="w-full sm:w-auto bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
            <Plus className="mr-2 h-4 w-4" /> {inv.newInvoice}
          </Button>
        )}
      </div>

      {/* Stats */}
      {!isLoading && invoices.length > 0 && (
        <section>
          <SectionHeader title={t.app.dashboard.overview} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatCard label={inv.totalInvoiced} value={formatCurrency(stats.totalSum)} sub={t.app.dashboard.invoicesCount.replace("{count}", String(invoices.length))} icon={FileText} accent="violet" />
            <StatCard label={t.app.dashboard.invoicesPaid} value={formatCurrency(stats.paidSum)} sub={t.app.dashboard.invoicesCount.replace("{count}", String(stats.paidCount))} icon={Wallet} accent="emerald" />
            <StatCard label={inv.awaitingPayment} value={formatCurrency(stats.pendingSum)} icon={Send} accent="cyan" />
            <StatCard label={t.app.dashboard.outstanding} value={formatCurrency(stats.unpaidSum)} sub={t.app.dashboard.invoicesCount.replace("{count}", String(stats.unpaidCount))} icon={AlertCircle} accent={stats.unpaidCount > 0 ? "amber" : "emerald"} />
          </div>
        </section>
      )}

      {/* Status filter — segmented pill toggle */}
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {[
          { key: "all", label: "All" },
          { key: "paid", label: "Paid" },
          { key: "unpaid", label: "Unpaid" },
          { key: "pending", label: "Pending" },
        ].map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className={`tabular-nums text-xs ${active ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                {filterCounts[tab.key as keyof typeof filterCounts]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <><CardListSkeleton count={3} /><TableSkeleton columns={5} rows={4} /></>
      ) : invoices.length === 0 ? (
        <Card className="animate-card-in">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <p className="font-display text-lg font-semibold">{t.common.noData}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t.app.dashboard.noInvoicesHint}</p>
          </CardContent>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card className="animate-card-in">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t.common.noData}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setStatusFilter("all")}>
              All ({filterCounts.all})
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {filteredInvoices.map((i: any) => (
              <Card key={i.id} className="animate-card-in card-interactive">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(Number(i.amount) || 0)}</p>
                      <p className="text-sm text-muted-foreground">{i.clients?.name ?? "No client"}</p>
                      {i.description && <p className="text-xs text-muted-foreground/80 mt-0.5">{i.description}</p>}
                    </div>
                    <Badge variant="outline" className={statusColor(i.status)}>
                      {(inv.statuses as any)[i.status]}
                    </Badge>
                  </div>
                  {i.events && <p className="text-sm text-muted-foreground truncate">{bookingsLabel(i.events)}</p>}
                  {i.sent_at && <p className="text-xs text-muted-foreground">Sent {format(new Date(i.sent_at), "MMM d, yyyy")}</p>}
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Button variant="outline" size="sm" className="h-9" onClick={async () => {
                      setPreviewInvoice(i); setPreviewOpen(true);
                      if (i.event_id) { const { data } = await supabase.from("event_payments").select("*").eq("event_id", i.event_id).order("payment_date", { ascending: true }); setPreviewPayments(data || []); } else { setPreviewPayments([]); }
                    }}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button variant="outline" size="sm" className="h-9" onClick={() => setSendInvoice(i)}>
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                    </Button>
                    {canWrite && i.status !== "paid" && (
                      <Button variant="outline" size="sm" className="h-9" onClick={() => setPaymentInvoice(i)}>
                        <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Payment
                      </Button>
                    )}
                    {canWrite && (
                      <>
                        <Button variant="outline" size="sm" className="h-9" onClick={() => openEdit(i)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(i.id)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{inv.amount}</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>{t.app.bookings.client}</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>{inv.status}</TableHead>
                  <TableHead>{inv.sentAt}</TableHead>
                  <TableHead className="w-auto" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((i: any) => (
                  <TableRow key={i.id} className="animate-row-in row-interactive">
                    <TableCell className="font-medium tabular-nums">{formatCurrency(Number(i.amount) || 0)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{i.description || "—"}</TableCell>
                    <TableCell>{i.clients?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{i.events ? bookingsLabel(i.events) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(i.status)}>
                        {(inv.statuses as any)[i.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {i.sent_at ? format(new Date(i.sent_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end flex-wrap">
                        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={async () => {
                          setPreviewInvoice(i); setPreviewOpen(true);
                          if (i.event_id) { const { data } = await supabase.from("event_payments").select("*").eq("event_id", i.event_id).order("payment_date", { ascending: true }); setPreviewPayments(data || []); } else { setPreviewPayments([]); }
                        }}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setSendInvoice(i)}>
                          <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                        </Button>
                        {canWrite && i.status !== "paid" && (
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setPaymentInvoice(i)}>
                            <DollarSign className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Payment
                          </Button>
                        )}
                        {canWrite && stripeConnected && (
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" disabled={generatingLink === i.id}
                            onClick={() => handlePaymentLink(i.id, i.stripe_payment_url)}>
                            {i.stripe_payment_url ? <Copy className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                            {i.stripe_payment_url ? "Copy Link" : "Pay Link"}
                          </Button>
                        )}
                        {canWrite && (
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openEdit(i)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                        {canWrite && (
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(i.id)}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Create Dialog (simple) */}
      <Dialog open={dialogOpen && !editing} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.common.create} {inv.title.toLowerCase()}</DialogTitle>
            <DialogDescription>Create a new invoice</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!(Number(form.amount) > 0)) return; saveMutation.mutate(form); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-amount">{inv.amount} *</Label>
              <Input id="invoice-amount" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.app.bookings.client}</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
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
              <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map((ev: any) => (
                    <SelectItem key={ev.id} value={ev.id}>{bookingsLabel(ev)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{inv.status}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{(inv.statuses as any)[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-gold text-primary-foreground font-semibold">
                {saveMutation.isPending ? t.common.loading : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (full contract view) */}
      {editing && (
        <EditInvoiceDialog
          open={!!editing}
          onOpenChange={(open) => { if (!open) closeDialog(); }}
          invoice={editing}
          clients={clients}
          events={events}
          onSaved={() => qc.invalidateQueries({ queryKey: ["invoices"] })}
        />
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription>Preview how the invoice will look</DialogDescription>
          </DialogHeader>
          {previewInvoice && (
            <>
              <InvoicePreview
                ref={previewRef}
                invoice={previewInvoice}
                artistName={profile?.full_name || undefined}
                artistLogo={profile?.avatar_url}
                workspaceName={tenant?.name}
                paymentInstructions={(tenant as any)?.payment_instructions}
                payments={previewPayments}
              />
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
                <Button onClick={() => { setPreviewOpen(false); setSendInvoice(previewInvoice); }}>
                  <Send className="mr-2 h-4 w-4" /> Send
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      {sendInvoice && (
        <SendInvoiceDialog
          open={!!sendInvoice}
          onOpenChange={(open) => { if (!open) setSendInvoice(null); }}
          invoice={sendInvoice}
          workspaceName={tenant?.name}
          onSent={() => qc.invalidateQueries({ queryKey: ["invoices"] })}
        />
      )}

      {/* Record Payment Dialog */}
      {paymentInvoice && (
        <RecordPaymentDialog
          open={!!paymentInvoice}
          onOpenChange={(open) => { if (!open) setPaymentInvoice(null); }}
          invoice={paymentInvoice}
        />
      )}

      <ConfirmDestructiveDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title={inv.confirmDeleteTitle}
        description={inv.confirmDeleteDescription}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        pendingLabel={t.common.deleting}
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); }}
      />
    </div>
  );
}
