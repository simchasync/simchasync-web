import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PAYMENT_STATUSES } from "@/lib/paymentStatuses";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { toHebrewDate } from "@/lib/hebrewDate";
import { getEventPaymentStatus } from "@/lib/eventPaymentStatus";
import { computeBalanceDue } from "@/lib/bookingFinancials";
import { buildNavigationAddress } from "@/lib/utils";
import NavigateButton from "./NavigateButton";
import PaymentsSection from "./PaymentsSection";
import SongsSection from "./SongsSection";
import AttachmentsSection from "./AttachmentsSection";
import ColleaguesSection from "./ColleaguesSection";
import ExpensesProfitSection from "./ExpensesProfitSection";
import AgentAssignmentSection from "./AgentAssignmentSection";
import EventTimingSection, { type TimingFields } from "./EventTimingSection";
import VenueAutocomplete from "./VenueAutocomplete";
import EventTypeSelect from "./EventTypeSelect";
import SectionLabel from "./SectionLabel";
import LocationAutocomplete from "./LocationAutocomplete";
import InlineClientDialog from "./InlineClientDialog";
import ClientHistoryDialog from "@/components/clients/ClientHistoryDialog";
import {
  Calendar, DollarSign, Clock, UserCheck, UserPlus, History,
  Pencil, Eye, CheckCircle2, Car, MapPin,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────


const emptyTiming: TimingFields = {
  chuppah_time: "", meal_time: "", first_dance_time: "",
  second_dance_time: "", mitzvah_tanz_time: "", event_start_time: "",
};

type FormState = {
  client_id: string; event_date: string; event_type: string;
  venue: string; location: string; total_price: string; deposit: string;
  balance_due: string; payment_status: string; deposit_status: string;
  due_date: string; notes: string; travel_fee: string; travel_fee_type: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildForm(ev: any): FormState {
  const total = Number(ev.total_price) || 0;
  const dep = Number(ev.deposit) || 0;
  const travelFee = Number(ev.travel_fee) || 0;
  const travelFeeType = ev.travel_fee_type ?? "expense";
  return {
    client_id: ev.client_id ?? "",
    event_date: ev.event_date ?? "",
    event_type: ev.event_type ?? "wedding",
    venue: ev.venue ?? "",
    location: ev.location ?? "",
    total_price: String(ev.total_price ?? ""),
    deposit: String(ev.deposit ?? ""),
    balance_due: String(ev.payment_status === "paid" ? 0 : computeBalanceDue(total, dep, travelFee, travelFeeType)),
    payment_status: ev.payment_status ?? "unpaid",
    deposit_status: ev.deposit_status ?? "unpaid",
    due_date: ev.due_date ?? "",
    notes: ev.notes ?? "",
    travel_fee: String(ev.travel_fee ?? ""),
    travel_fee_type: ev.travel_fee_type ?? "expense",
  };
}

function buildTiming(ev: any): TimingFields {
  return {
    chuppah_time: ev.chuppah_time ?? "",
    meal_time: ev.meal_time ?? "",
    first_dance_time: ev.first_dance_time ?? "",
    second_dance_time: ev.second_dance_time ?? "",
    mitzvah_tanz_time: ev.mitzvah_tanz_time ?? "",
    event_start_time: ev.event_start_time ?? "",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ViewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any | null;
  defaultMode?: "view" | "edit";
  onSaved?: () => void;
}

export default function ViewBookingDialog({
  open, onOpenChange, event, defaultMode = "view", onSaved,
}: ViewBookingDialogProps) {
  const { t } = useLanguage();
  const b = t.app.bookings;
  const { canAccess } = useSubscription();
  const { canWrite, role } = useUserRole();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"view" | "edit">(defaultMode);
  const [form, setForm] = useState<FormState>(() => event ? buildForm(event) : buildForm({}));
  const [timing, setTiming] = useState<TimingFields>(() => event ? buildTiming(event) : emptyTiming);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const tenantId: string = event?.tenant_id ?? "";
  const showFinancialFields = role !== "member";
  const showExpenses = canAccess("expenses_profit") && role !== "member";

  // Reset when a new event is opened or mode preference changes
  useEffect(() => {
    if (open && event) {
      setForm(buildForm(event));
      setTiming(buildTiming(event));
      setMode(defaultMode);
    }
  }, [open, event, defaultMode]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients").select("id, name").eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: !!tenantId && mode === "edit" && role !== "member",
  });

  const { data: linkedInvoices = [] } = useQuery({
    queryKey: ["invoices", "event", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices").select("id, status, event_id").eq("event_id", event!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!event?.id,
  });

  const { data: assignedAgents = [] } = useQuery({
    queryKey: ["booking-agents", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents").select("*, agents(name)").eq("event_id", event!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!event?.id && role !== "member",
  });

  // Shares its query key with PaymentsSection, so adding/removing a payment
  // there immediately refreshes the Balance Due shown here.
  const { data: paymentRecords = [] } = useQuery({
    queryKey: ["event_payments", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_payments").select("amount").eq("event_id", event!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!event?.id && showFinancialFields,
  });

  const paymentsTotal = paymentRecords.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  // ── Mutation ──────────────────────────────────────────────────────────────

  const updateFinancials = (field: string, value: string) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      const total = Number(updated.total_price) || 0;
      const dep = Number(updated.deposit) || 0;
      const travelFee = Number(updated.travel_fee) || 0;
      const balance = updated.payment_status === "paid" ? 0 : computeBalanceDue(total, dep, travelFee, updated.travel_fee_type);
      return { ...updated, balance_due: String(balance) };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const hebrewDate = values.event_date ? toHebrewDate(values.event_date) : null;
      const travelFee = Number(values.travel_fee) || 0;
      const totalPrice = Number(values.total_price) || 0;
      const deposit = Number(values.deposit) || 0;
      const travelFeeType = travelFee > 0 ? (values.travel_fee_type || "expense") : "expense";

      const payload: any = {
        client_id: values.client_id || null,
        event_date: values.event_date,
        event_type: values.event_type,
        venue: values.venue || null,
        location: values.location || null,
        total_price: totalPrice,
        deposit,
        balance_due: values.payment_status === "paid" ? 0 : computeBalanceDue(totalPrice, deposit, travelFee, travelFeeType),
        payment_status: values.payment_status,
        deposit_status: values.deposit_status || "unpaid",
        due_date: values.due_date || null,
        notes: values.notes || null,
        hebrew_date: hebrewDate,
        travel_fee: travelFee,
        travel_fee_type: travelFeeType,
        chuppah_time: timing.chuppah_time || null,
        meal_time: timing.meal_time || null,
        first_dance_time: timing.first_dance_time || null,
        second_dance_time: timing.second_dance_time || null,
        mitzvah_tanz_time: timing.mitzvah_tanz_time || null,
        event_start_time: timing.event_start_time || null,
      };

      const { data, error } = await supabase
        .from("events").update(payload).eq("id", event!.id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ["events"] });

      // Sync deposit invoice status
      const deposit = Number(data.deposit) || 0;
      const depositStatus = (data as any).deposit_status || "unpaid";
      if (deposit > 0) {
        if (depositStatus === "paid") {
          const { data: inv, error: le } = await supabase
            .from("invoices").select("id").eq("event_id", data.id)
            .ilike("description", "Deposit for%").neq("status", "paid").maybeSingle();
          if (le) throw le;
          if (inv) {
            const { error: ue } = await supabase.from("invoices").update({ status: "paid" }).eq("id", inv.id);
            if (ue) throw ue;
            qc.invalidateQueries({ queryKey: ["invoices"] });
          }
        } else {
          const { data: inv, error: le } = await supabase
            .from("invoices").select("id").eq("event_id", data.id)
            .ilike("description", "Deposit for%").eq("status", "paid").maybeSingle();
          if (le) throw le;
          if (inv) {
            const { error: ue } = await supabase.from("invoices").update({ status: "draft" }).eq("id", inv.id);
            if (ue) throw ue;
            qc.invalidateQueries({ queryKey: ["invoices"] });
          }
        }
      }

      // Sync agent commission amounts with the new total price
      const newTotal = Number(data.total_price) || 0;
      const { data: agentRows } = await supabase
        .from("booking_agents").select("id, commission_rate").eq("event_id", data.id);
      if (agentRows && agentRows.length > 0) {
        await Promise.all(
          agentRows.map((ba: any) =>
            supabase.from("booking_agents")
              .update({ commission_amount: Math.round(newTotal * Number(ba.commission_rate) / 100 * 100) / 100 })
              .eq("id", ba.id)
          )
        );
        qc.invalidateQueries({ queryKey: ["booking-agents", data.id] });
        qc.invalidateQueries({ queryKey: ["event-agent-commissions", data.id] });
      }

      // Refresh local state with saved data
      setForm(buildForm(data));
      setTiming(buildTiming(data));
      setMode("view");
      toast({ title: "Booking updated" });
      onSaved?.();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!event) return null;

  const displayPaymentStatus = getEventPaymentStatus(event, linkedInvoices);
  const address = buildNavigationAddress(event.venue, event.location);
  const totalCommission = assignedAgents.reduce((s: number, ba: any) => s + (Number(ba.commission_amount) || 0), 0);

  // Live balance due = stored (total - deposit) less any payments recorded in
  // the Payments section below, so it reflects changes made without re-saving the form.
  const baseBalance = mode === "edit" ? Number(form.balance_due) || 0 : Number(event.balance_due) || 0;
  const remainingBalance = Math.max(baseBalance - paymentsTotal, 0);

  const statusMap: Record<string, { label: string; className: string }> = {
    paid: { label: (b.paymentStatus as any).paid ?? "Paid", className: "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" },
    partial: { label: (b.paymentStatus as any).partial ?? "Partial", className: "bg-amber-500/15 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800" },
    unpaid: { label: (b.paymentStatus as any).unpaid ?? "Unpaid", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const statusCfg = statusMap[displayPaymentStatus] ?? statusMap.unpaid;

  // ── Sub-sections shared between both modes ────────────────────────────────

  const subSections = (editable: boolean) => (
    <>
      <Separator />
      <ColleaguesSection eventId={event.id} canWrite={editable} tenantId={tenantId} />

      {showFinancialFields && (
        <>
          <Separator />
          <PaymentsSection eventId={event.id} canWrite={editable} />
        </>
      )}

      <Separator />
      <SongsSection eventId={event.id} canWrite={editable} eventType={event.event_type} />
      <Separator />
      <AttachmentsSection eventId={event.id} canWrite={editable} />

      {showExpenses && (
        <>
          <Separator />
          <ExpensesProfitSection
            eventId={event.id}
            canWrite={editable}
            totalRevenue={editable ? (Number(form.total_price) || 0) : (event.total_price ?? 0)}
          />
        </>
      )}

      {role === "owner" && (
        <>
          <Separator />
          <AgentAssignmentSection
            eventId={event.id}
            canWrite={editable}
            totalPrice={editable ? (Number(form.total_price) || 0) : (Number(event.total_price) || 0)}
          />
        </>
      )}
    </>
  );

  // ── VIEW mode ─────────────────────────────────────────────────────────────

  const viewContent = (
    <div className="flex-1 overflow-y-auto">
      {/* Date + status hero strip */}
      <div className="px-6 py-3 bg-muted/30 border-b flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium">{format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}</span>
          {event.hebrew_date && (
            <span className="text-xs text-muted-foreground">· {event.hebrew_date}</span>
          )}
        </div>
        <Badge variant="outline" className={`self-start sm:self-auto text-xs font-medium ${statusCfg.className}`}>
          {statusCfg.label}
        </Badge>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Event Details */}
        <ViewSection title="Event Details">
          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-6">
            <Field label={b.client}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{event.clients?.name ?? event.client_name ?? "—"}</span>
                {role !== "member" && event.client_id && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setHistoryOpen(true)}>
                    <History className="h-3 w-3 mr-1" />History
                  </Button>
                )}
              </div>
            </Field>
            <Field label={b.eventType}>
              <span className="font-medium text-sm">{(b.types as any)[event.event_type] ?? event.event_type}</span>
            </Field>
            <Field label={b.venue}>
              <span className="font-medium text-sm">{event.venue || "—"}</span>
            </Field>
            <Field label={b.location}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{event.location || "—"}</span>
                {address && <NavigateButton address={address} size="icon" />}
              </div>
            </Field>
            {event.notes && (
              <div className="sm:col-span-2 space-y-1 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{b.notes}</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{event.notes}</p>
              </div>
            )}
          </div>
        </ViewSection>

        {/* Financials */}
        {showFinancialFields && (
          <>
            <Separator />
            <ViewSection title="Financials" icon={DollarSign}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label={b.totalPrice}>
                  <span className="font-semibold text-sm">${Number(event.total_price ?? 0).toLocaleString()}</span>
                </Field>
                <Field label={b.deposit}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm">${Number(event.deposit ?? 0).toLocaleString()}</span>
                    {event.deposit > 0 && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${event.deposit_status === "paid" ? "bg-emerald-500/15 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"}`}>
                        {event.deposit_status ?? "unpaid"}
                      </Badge>
                    )}
                  </div>
                </Field>
                <Field label={b.balanceDue}>
                  <span className={`font-medium text-sm ${remainingBalance > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    ${remainingBalance.toLocaleString()}
                  </span>
                </Field>
                {Number(event.travel_fee) > 0 && (
                  <Field label="Travel Fee">
                    <div className="flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm">${Number(event.travel_fee).toLocaleString()}</span>
                      <span className={`text-xs ${event.travel_fee_type === "charge_customer" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {event.travel_fee_type === "charge_customer" ? "· billed" : "· expense"}
                      </span>
                    </div>
                  </Field>
                )}
                {event.due_date && (
                  <Field label={b.dueDate}>
                    <span className="font-medium text-sm">{format(new Date(event.due_date), "MMM d, yyyy")}</span>
                  </Field>
                )}
              </div>
            </ViewSection>
          </>
        )}

        {/* Timing */}
        {(event.chuppah_time || event.meal_time || event.first_dance_time || event.second_dance_time || event.mitzvah_tanz_time || event.event_start_time) && (
          <>
            <Separator />
            <ViewSection title={b.timing.title} icon={Clock}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {(event.event_type === "wedding"
                  ? [
                      { label: b.timing.chuppah, value: event.chuppah_time },
                      { label: b.timing.meal, value: event.meal_time },
                      { label: b.timing.firstDance, value: event.first_dance_time },
                      { label: b.timing.secondDance, value: event.second_dance_time },
                      { label: b.timing.mitzvahTanz, value: event.mitzvah_tanz_time },
                    ]
                  : [{ label: b.timing.eventStart, value: event.event_start_time }]
                ).filter(f => f.value).map(f => (
                  <Field key={f.label} label={f.label}>
                    <span className="font-medium text-sm">{f.value}</span>
                  </Field>
                ))}
              </div>
            </ViewSection>
          </>
        )}

        {/* Assigned Agents */}
        {role !== "member" && assignedAgents.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionLabel icon={UserCheck} title="Referral Agents" />
                {totalCommission > 0 && (
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-200 text-xs">
                    ${totalCommission.toLocaleString()} total
                  </Badge>
                )}
              </div>
              <div className="space-y-1.5">
                {assignedAgents.map((ba: any) => (
                  <div key={ba.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{ba.agents?.name ?? "Agent"}</p>
                      <p className="text-xs text-muted-foreground">{ba.commission_rate}% = ${Number(ba.commission_amount || 0).toLocaleString()}</p>
                    </div>
                    {ba.commission_paid
                      ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-200 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Paid</Badge>
                      : <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-200 text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>
                    }
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {subSections(false)}
      </div>
    </div>
  );

  // ── EDIT mode ─────────────────────────────────────────────────────────────

  const editContent = (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Event Details */}
        <div className="space-y-3">
          <SectionLabel icon={Calendar} title="Event Details" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{b.eventType} *</Label>
              <EventTypeSelect
                value={form.event_type}
                onChange={(event_type) => setForm(prev => ({ ...prev, event_type }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{b.client}</Label>
              <div className="flex gap-1.5">
                <Select value={form.client_id} onValueChange={(v) => setForm(prev => ({ ...prev, client_id: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(cl => (
                      <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canWrite && (
                  <Button type="button" variant="outline" size="icon" onClick={() => setClientDialogOpen(true)} title="Add client">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{b.date} *</Label>
              <Input type="date" required value={form.event_date} onChange={(e) => setForm(prev => ({ ...prev, event_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{b.hebrewDate}</Label>
              <Input disabled value={form.event_date ? toHebrewDate(form.event_date) : ""} className="bg-muted text-sm" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Location */}
        <div className="space-y-3">
          <SectionLabel icon={MapPin} title="Location" />
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{b.venue}</Label>
              <VenueAutocomplete
                value={form.venue}
                onChange={(venue, location) => setForm(prev => ({ ...prev, venue, location: location || prev.location }))}
                placeholder="Search venue name..."
              />
              <p className="text-[11px] text-muted-foreground/80">{b.venueNameHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{b.location}</Label>
              <div className="flex gap-1.5">
                <LocationAutocomplete
                  value={form.location}
                  onChange={(location) => setForm(prev => ({ ...prev, location }))}
                  placeholder="Search for an address..."
                />
                {(form.location || form.venue) && <NavigateButton address={buildNavigationAddress(form.venue, form.location)} size="icon" />}
              </div>
            </div>
          </div>
        </div>

        {/* Financials */}
        {showFinancialFields && (
          <>
            <Separator />
            <div className="space-y-3">
              <SectionLabel title="Financials" icon={DollarSign} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">{b.totalPrice}</Label>
                  <Input type="number" min="0" value={form.total_price} onChange={(e) => updateFinancials("total_price", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Travel Fee</Label>
                  <Input type="number" min="0" value={form.travel_fee} onChange={(e) => updateFinancials("travel_fee", e.target.value)} placeholder="0" />
                </div>
                {Number(form.travel_fee) > 0 && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-sm">{b.financials.travelFeeTreat}</Label>
                    <Select value={form.travel_fee_type} onValueChange={(v) => updateFinancials("travel_fee_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="charge_customer">{b.financials.travelChargeCustomer}</SelectItem>
                        <SelectItem value="expense">{b.financials.travelExpense}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-sm">{b.deposit}</Label>
                  <Input type="number" min="0" value={form.deposit} onChange={(e) => updateFinancials("deposit", e.target.value)} />
                </div>
                {Number(form.deposit) > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">{b.financials.depositStatus}</Label>
                    <Select value={form.deposit_status} onValueChange={(v) => setForm(prev => ({ ...prev, deposit_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">{b.paymentStatus.unpaid}</SelectItem>
                        <SelectItem value="paid">{b.paymentStatus.paid}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-sm">{b.balanceDue}</Label>
                  <Input disabled value={remainingBalance} className="bg-muted" />
                  {paymentsTotal > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      ${Number(form.balance_due || 0).toLocaleString()} less ${paymentsTotal.toLocaleString()} in recorded payments
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{b.financials.bookingStatus}</Label>
                  <Select value={form.payment_status} onValueChange={(v) => {
                    const total = Number(form.total_price) || 0;
                    const dep = Number(form.deposit) || 0;
                    const travelFee = Number(form.travel_fee) || 0;
                    const rawBalance = computeBalanceDue(total, dep, travelFee, form.travel_fee_type);
                    if (v === "paid") {
                      const outstanding = Math.max(rawBalance - paymentsTotal, 0);
                      if (outstanding > 0) {
                        toast({
                          title: "Heads up",
                          description: `$${outstanding.toLocaleString()} still appears unpaid based on the total, deposit, and recorded payments. Marking this "Paid" will set the balance due to $0.`,
                        });
                      }
                    }
                    setForm(prev => ({
                      ...prev,
                      payment_status: v,
                      balance_due: String(v === "paid" ? 0 : rawBalance),
                    }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{(b.paymentStatus as any)[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{b.dueDate}</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))} />
                </div>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-sm">{b.notes}</Label>
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} className="resize-none" />
        </div>

        {/* Timing */}
        <Separator />
        <EventTimingSection eventType={form.event_type} timing={timing} onChange={setTiming} canWrite={canWrite} />

        {subSections(canWrite)}
      </div>

      {/* Sticky save/cancel footer */}
      <div className="shrink-0 border-t bg-background px-6 py-4">
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => { setForm(buildForm(event)); setTiming(buildTiming(event)); setMode("view"); }}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={saveMutation.isPending}
            className="bg-gradient-gold text-primary-foreground font-semibold"
            onClick={() => saveMutation.mutate(form)}
          >
            {saveMutation.isPending ? t.common.loading : t.common.save}
          </Button>
        </DialogFooter>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col w-full sm:max-w-2xl max-h-[90vh] gap-0 p-0 overflow-hidden">

          {/* Header — title, description, mode toggle */}
          <DialogHeader className="px-6 pt-5 pb-4 pr-14 shrink-0 border-b">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-snug">
                  {(b.types as any)[event.event_type] ?? event.event_type}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  {mode === "edit" ? "Editing booking details" : "Viewing booking details"}
                </DialogDescription>
              </div>
              {canWrite && mode === "view" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 gap-1.5 text-xs"
                  onClick={() => setMode("edit")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              {mode === "edit" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => { setForm(buildForm(event)); setTiming(buildTiming(event)); setMode("view"); }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
              )}
            </div>
          </DialogHeader>

          {mode === "view" ? viewContent : editContent}
        </DialogContent>
      </Dialog>

      {/* Client history dialog */}
      {event.client_id && (
        <ClientHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          clientId={event.client_id}
          clientName={event.clients?.name ?? "Client"}
          currentEventId={event.id}
        />
      )}

      {/* Quick-add client */}
      <InlineClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        tenantId={tenantId}
        onClientCreated={(clientId) => {
          setForm(prev => ({ ...prev, client_id: clientId }));
          qc.invalidateQueries({ queryKey: ["clients", tenantId] });
        }}
      />
    </>
  );
}

function ViewSection({ title, icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <SectionLabel icon={icon} title={title} />
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}