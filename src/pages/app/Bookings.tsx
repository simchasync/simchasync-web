import { useState, useEffect } from "react";
import { CardListSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { syncEventToCalendar } from "@/hooks/useGoogleCalendar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toHebrewDate } from "@/lib/hebrewDate";
import { getEventPaymentStatus } from "@/lib/eventPaymentStatus";
import { computeBalanceDue } from "@/lib/bookingFinancials";
import { buildNavigationAddress } from "@/lib/utils";
import { DEFAULT_EVENT_TYPE } from "@/lib/eventTypes";
import { DEFAULT_TRAVEL_FEE_TYPE } from "@/lib/travelFeeTypes";
import { PAYMENT_STATUSES, DEFAULT_PAYMENT_STATUS } from "@/lib/paymentStatuses";
import { Button } from "@/components/ui/button";
import { Card as MuiCard, CardContent as MuiCardContent, Chip } from "@mui/material";
import { StatCard, SectionHeader } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Calendar, Pencil, Trash2, FileText, UserPlus, Eye, DollarSign, History, CalendarDays, List, MapPin, BarChart3, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import BookingRequests, { useBookingRequestCount } from "@/components/BookingRequests";
import AgentAssignmentSection from "@/components/bookings/AgentAssignmentSection";
import InlineClientDialog from "@/components/bookings/InlineClientDialog";
import PaymentsSection from "@/components/bookings/PaymentsSection";
import SongsSection from "@/components/bookings/SongsSection";
import AttachmentsSection from "@/components/bookings/AttachmentsSection";
import VenueAutocomplete from "@/components/bookings/VenueAutocomplete";
import EventTypeSelect from "@/components/bookings/EventTypeSelect";
import SectionLabel from "@/components/bookings/SectionLabel";
import LocationAutocomplete from "@/components/bookings/LocationAutocomplete";
import ViewBookingDialog from "@/components/bookings/ViewBookingDialog";
import NavigateButton from "@/components/bookings/NavigateButton";
import EventTimingSection, { type TimingFields } from "@/components/bookings/EventTimingSection";
import ColleaguesSection from "@/components/bookings/ColleaguesSection";
import ExpensesProfitSection from "@/components/bookings/ExpensesProfitSection";
import ClientHistoryDialog from "@/components/clients/ClientHistoryDialog";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";

import BookingCalendar from "@/components/bookings/BookingCalendar";

type Event = Tables<"events">;
type Client = Tables<"clients">;
const BOOKINGS_PAGE_SIZE = 10;

const emptyTiming: TimingFields = {
  chuppah_time: "", meal_time: "", first_dance_time: "", second_dance_time: "", mitzvah_tanz_time: "", event_start_time: "",
};

const emptyForm = {
  client_id: "", event_date: "", event_type: DEFAULT_EVENT_TYPE as string, venue: "", location: "",
  total_price: "", deposit: "", balance_due: "", payment_status: DEFAULT_PAYMENT_STATUS as string,
  deposit_status: DEFAULT_PAYMENT_STATUS as string,
  due_date: "", notes: "", travel_fee: "", travel_fee_type: DEFAULT_TRAVEL_FEE_TYPE as string,
};

export default function Bookings() {
  const { t } = useLanguage();
  const b = t.app.bookings;
  const d = t.app.dashboard;
  const { tenantId } = useTenantId();
  const { canWrite, role, isLoading: roleLoading } = useUserRole();
  const { canAccess } = useSubscription();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [eventDateFilter, setEventDateFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [timing, setTiming] = useState<TimingFields>(emptyTiming);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [expenseDialogEvent, setExpenseDialogEvent] = useState<any>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [historyClientName, setHistoryClientName] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", tenantId, role],
    queryFn: async () => {
      if (role === "member") {
        const { data, error } = await supabase.rpc("get_member_bookings", {
          _tenant_id: tenantId!,
        });
        if (error) throw error;
        return (data ?? []) as any[];
      }

      const { data, error } = await supabase
        .from("events")
        .select("*, clients(name)")
        .eq("tenant_id", tenantId!)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !roleLoading,
  });

  // Realtime sync for events changes
  useRealtimeInvalidate({
    channel: `events-realtime-${tenantId}`,
    table: "events",
    filter: `tenant_id=eq.${tenantId}`,
    queryKey: ["events", tenantId],
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return data as Pick<Client, "id" | "name">[];
    },
    enabled: !!tenantId && role !== "member",
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, event_id, status, created_at")
        .eq("tenant_id", tenantId!)
        .not("event_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && role !== "member",
  });

  // Shares its query key with PaymentsSection, so adding/removing a payment
  // there immediately refreshes the Balance Due shown in the edit form.
  const { data: editingPayments = [] } = useQuery({
    queryKey: ["event_payments", editing?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_payments").select("amount").eq("event_id", editing!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!editing?.id && role !== "member",
  });

  const editingPaymentsTotal = editingPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const hebrewDate = values.event_date ? toHebrewDate(values.event_date) : null;
      const travelFee = values.travel_fee ? Number(values.travel_fee) : 0;
      const totalPrice = values.total_price ? Number(values.total_price) : 0;
      const deposit = values.deposit ? Number(values.deposit) : 0;
      const travelFeeType = travelFee > 0 ? (values.travel_fee_type || "expense") : "expense";
      const balanceDue = computeBalanceDue(totalPrice, deposit, travelFee, travelFeeType);

      const payload: any = {
        client_id: values.client_id || null,
        event_date: values.event_date,
        event_type: values.event_type,
        venue: values.venue || null,
        location: values.location || null,
        total_price: totalPrice,
        deposit: deposit,
        balance_due: values.payment_status === "paid" ? 0 : balanceDue,
        payment_status: values.payment_status as Event["payment_status"],
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

      if (editing) {
        const { data, error } = await supabase.from("events").update(payload).eq("id", editing.id).select().single();
        if (error) throw error;
        return { data, isNew: false, wasStatus: editing.payment_status };
      } else {
        const { data, error } = await supabase.from("events").insert({ ...payload, tenant_id: tenantId! }).select().single();
        if (error) throw error;
        return { data, isNew: true, wasStatus: null };
      }
    },
    onSuccess: async (result) => {
      const { data, isNew } = result;
      qc.invalidateQueries({ queryKey: ["events", tenantId] });
      if (tenantId && data?.id) void syncEventToCalendar(tenantId, "upsert", data.id);

      const totalPrice = Number(data.total_price) || 0;
      const deposit = Number(data.deposit) || 0;
      const depositStatus = (data as any).deposit_status || "unpaid";
      const paymentStatus = data.payment_status;

      // Auto-generate invoices for new bookings
      if (isNew && totalPrice > 0) {
        const invoicesToCreate: any[] = [];
        const clientName = clients.find((c: any) => c.id === data.client_id)?.name || "Client";
        const eventLabel = `${data.event_type} — ${format(new Date(data.event_date), "MMM d, yyyy")}`;

        // Deposit invoice: always create if deposit > 0
        if (deposit > 0) {
          invoicesToCreate.push({
            tenant_id: tenantId!,
            client_id: data.client_id || null,
            event_id: data.id,
            amount: deposit,
            description: `Deposit for ${eventLabel} (${clientName})`,
            status: depositStatus === "paid" ? "paid" : "draft",
          });
        }

        // Balance invoice: remaining amount after deposit
        const balanceAmount = Math.max(totalPrice - deposit, 0);
        if (balanceAmount > 0) {
          invoicesToCreate.push({
            tenant_id: tenantId!,
            client_id: data.client_id || null,
            event_id: data.id,
            amount: balanceAmount,
            description: `Balance for ${eventLabel} (${clientName})`,
            status: paymentStatus === "paid" ? "paid" : "draft",
          });
        }

        // Travel fee invoice: only when charged to the customer
        const travelFeeAmount = Number((data as any).travel_fee) || 0;
        if (travelFeeAmount > 0 && (data as any).travel_fee_type === "charge_customer") {
          invoicesToCreate.push({
            tenant_id: tenantId!,
            client_id: data.client_id || null,
            event_id: data.id,
            amount: travelFeeAmount,
            description: `Travel Fee for ${eventLabel} (${clientName})`,
            status: "draft",
          });
        }

        if (invoicesToCreate.length > 0) {
          await supabase.from("invoices").insert(invoicesToCreate);
          qc.invalidateQueries({ queryKey: ["invoices"] });
          toast({ title: `${invoicesToCreate.length} invoice(s) auto-generated` });
        }
      }

      if (isNew) {
        toast({ title: "Booking created successfully" });
        setEditing(data);
        const savedTotal = Number(data.total_price) || 0;
        const savedDep = Number(data.deposit) || 0;
        const savedTravelFee = Number((data as any).travel_fee) || 0;
        const savedTravelFeeType = (data as any).travel_fee_type ?? "expense";
        const savedBalance = data.payment_status === "paid" ? 0 : computeBalanceDue(savedTotal, savedDep, savedTravelFee, savedTravelFeeType);
        setForm({
          client_id: data.client_id ?? "",
          event_date: data.event_date,
          event_type: data.event_type,
          venue: data.venue ?? "",
          location: data.location ?? "",
          total_price: String(data.total_price ?? ""),
          deposit: String(data.deposit ?? ""),
          balance_due: String(savedBalance),
          payment_status: data.payment_status,
          deposit_status: (data as any).deposit_status ?? "unpaid",
          due_date: data.due_date ?? "",
          notes: data.notes ?? "",
          travel_fee: String((data as any).travel_fee ?? ""),
          travel_fee_type: (data as any).travel_fee_type ?? "expense",
        });
        setTiming({
          chuppah_time: data.chuppah_time ?? "",
          meal_time: data.meal_time ?? "",
          first_dance_time: data.first_dance_time ?? "",
          second_dance_time: data.second_dance_time ?? "",
          mitzvah_tanz_time: data.mitzvah_tanz_time ?? "",
          event_start_time: data.event_start_time ?? "",
        });
      } else {
        // Sync deposit invoice status with deposit_status field
        if (deposit > 0) {
          if (depositStatus === "paid") {
            const { data: depositInvoice, error: lookupErr } = await supabase
              .from("invoices")
              .select("id")
              .eq("event_id", data.id)
              .ilike("description", "Deposit for%")
              .neq("status", "paid")
              .maybeSingle();
            if (lookupErr) throw lookupErr;
            if (depositInvoice) {
              const { error: updateErr } = await supabase.from("invoices").update({ status: "paid" }).eq("id", depositInvoice.id);
              if (updateErr) throw updateErr;
              qc.invalidateQueries({ queryKey: ["invoices"] });
            }
          } else {
            const { data: depositInvoice, error: lookupErr } = await supabase
              .from("invoices")
              .select("id")
              .eq("event_id", data.id)
              .ilike("description", "Deposit for%")
              .eq("status", "paid")
              .maybeSingle();
            if (lookupErr) throw lookupErr;
            if (depositInvoice) {
              const { error: updateErr } = await supabase.from("invoices").update({ status: "draft" }).eq("id", depositInvoice.id);
              if (updateErr) throw updateErr;
              qc.invalidateQueries({ queryKey: ["invoices"] });
            }
          }
        }
        // Sync agent commission amounts with the updated total price
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

        closeDialog();
        toast({ title: "Event updated" });
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["events", tenantId] });
      if (tenantId) void syncEventToCalendar(tenantId, "delete", id);
      toast({ title: "Event deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (ev: any) => {
      const totalPrice = Number(ev.total_price) || 0;
      const deposit = Number(ev.deposit) || 0;
      const invoiceAmount = Math.max(totalPrice - deposit, 0);
      const clientName = ev.clients?.name || ev.client_name || "Client";
      const eventLabel = `${ev.event_type} — ${format(new Date(ev.event_date), "MMM d, yyyy")}`;
      const { error } = await supabase.from("invoices").insert({
        tenant_id: tenantId!,
        client_id: ev.client_id || null,
        event_id: ev.id,
        amount: invoiceAmount > 0 ? invoiceAmount : totalPrice,
        description: `Invoice for ${eventLabel} (${clientName})`,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice created" });
      navigate("/app/invoices");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Auto-open edit dialog from query param (e.g. from Dashboard)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && events.length > 0) {
      const ev = events.find((e: any) => e.id === editId);
      if (ev) {
        openEdit(ev);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, events]);

  // Reset to first page whenever the filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [paymentFilter, eventDateFilter]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setTiming(emptyTiming); setDialogOpen(true); };
  const openEdit = (ev: any) => {
    setEditing(ev);
    const total = Number(ev.total_price) || 0;
    const dep = Number(ev.deposit) || 0;
    const evTravelFee = Number(ev.travel_fee) || 0;
    const evTravelFeeType = ev.travel_fee_type ?? "expense";
    const computedBalance = ev.payment_status === "paid" ? 0 : computeBalanceDue(total, dep, evTravelFee, evTravelFeeType);
    setForm({
      client_id: ev.client_id ?? "",
      event_date: ev.event_date,
      event_type: ev.event_type,
      venue: ev.venue ?? "",
      location: ev.location ?? "",
      total_price: String(ev.total_price ?? ""),
      deposit: String(ev.deposit ?? ""),
      balance_due: String(computedBalance),
      payment_status: ev.payment_status,
      deposit_status: ev.deposit_status ?? "unpaid",
      due_date: ev.due_date ?? "",
      notes: ev.notes ?? "",
      travel_fee: String(ev.travel_fee ?? ""),
      travel_fee_type: ev.travel_fee_type ?? "expense",
    });
    setTiming({
      chuppah_time: ev.chuppah_time ?? "",
      meal_time: ev.meal_time ?? "",
      first_dance_time: ev.first_dance_time ?? "",
      second_dance_time: ev.second_dance_time ?? "",
      mitzvah_tanz_time: ev.mitzvah_tanz_time ?? "",
      event_start_time: ev.event_start_time ?? "",
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); setTiming(emptyTiming); };

  const paymentBadgeConfig: Record<string, { label: string; className: string }> = {
    paid: { label: "Paid", className: "bg-emerald/10 text-emerald border-emerald/20" },
    partial: { label: "Partial", className: "bg-amber/10 text-amber border-amber/20" },
    unpaid: { label: "Unpaid", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const statusColor = (s: string) => {
    const cfg = paymentBadgeConfig[s];
    return cfg ? cfg.className : "bg-muted text-muted-foreground border-border";
  };

  const invoicesByEventId = invoices.reduce((acc: Record<string, any[]>, invoice: any) => {
    if (!invoice.event_id) return acc;
    if (!acc[invoice.event_id]) acc[invoice.event_id] = [];
    acc[invoice.event_id].push(invoice);
    return acc;
  }, {});

  const openOrCreateInvoice = (ev: any) => {
    const linkedInvoices = invoicesByEventId[ev.id] ?? [];
    if (linkedInvoices.length > 0) {
      navigate(`/app/invoices?invoice=${linkedInvoices[0].id}&event=${ev.id}`);
      return;
    }
    generateInvoiceMutation.mutate(ev);
  };

  const updateFinancials = (field: "total_price" | "deposit" | "travel_fee" | "travel_fee_type", value: string) => {
    const updated = { ...form, [field]: value };
    const total = Number(updated.total_price) || 0;
    const dep = Number(updated.deposit) || 0;
    const travelFee = Number(updated.travel_fee) || 0;
    // Balance due includes the travel fee only when it's billed to the customer
    updated.balance_due = String(computeBalanceDue(total, dep, travelFee, updated.travel_fee_type));
    setForm(updated);
  };

  const showExpenses = canAccess("expenses_profit") && role !== "member";
  const showFinancialFields = role !== "member";
  const pendingRequestCount = useBookingRequestCount(role !== "member" ? tenantId : null);
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const eventDateMin = editing && form.event_date && form.event_date < todayIso ? form.event_date : todayIso;

  const totalBookingsCount = events.length;
  const paidBookingsCount = events.filter((ev: any) => getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []) === "paid").length;
  const upcomingCount = events.filter((ev: any) => ev.event_date >= todayIso).length;
  const unpaidCount = events.filter((ev: any) => getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []) !== "paid").length;
  const outstandingTotal = events.reduce((sum: number, ev: any) => {
    if (getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []) === "paid") return sum;
    return sum + Math.max((Number(ev.total_price) || 0) - (Number(ev.deposit) || 0), 0);
  }, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight mb-0.5">{b.title}</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        {canWrite && (
          <Button onClick={openNew} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
            <Plus className="mr-2 h-4 w-4" /> {b.newEvent}
          </Button>
        )}
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events"><List className="mr-1.5 h-3.5 w-3.5" />{b.title}</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="mr-1.5 h-3.5 w-3.5" />Calendar</TabsTrigger>
          {role !== "member" && (
            <TabsTrigger value="requests" className="relative">
              {b.requests}
              {pendingRequestCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {pendingRequestCount}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          {/* Stats */}
          {!isLoading && events.length > 0 && (
            <section>
              <SectionHeader title={d.overview} />
              <div className={`grid grid-cols-2 gap-3 md:gap-4 ${showFinancialFields ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                <StatCard
                  label={d.totalBookings}
                  value={`${totalBookingsCount}`}
                  sub={d.paidCount.replace("{count}", String(paidBookingsCount))}
                  icon={BarChart3}
                  accent="violet"
                />
                <StatCard label={d.upcoming} value={`${upcomingCount}`} icon={Calendar} accent="cyan" />
                {showFinancialFields && (
                  <StatCard
                    label={d.outstanding}
                    value={`$${outstandingTotal.toLocaleString()}`}
                    sub={d.unpaidBookings.replace("{count}", String(unpaidCount))}
                    icon={AlertCircle}
                    accent="amber"
                  />
                )}
              </div>
            </section>
          )}

          {/* Filters */}
          <MuiCard variant="outlined">
            <MuiCardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1 overflow-x-auto max-w-full">
                {["all", "unpaid", "partial", "paid"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPaymentFilter(status)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      paymentFilter === status
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status === "all" ? "All" : (b.paymentStatus as any)[status] ?? status}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                <Label htmlFor="bookings-date-filter" className="text-xs font-medium text-muted-foreground">
                  {b.date}
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-[200px]">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="bookings-date-filter"
                      type="date"
                      value={eventDateFilter}
                      onChange={(e) => setEventDateFilter(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {eventDateFilter && (
                    <Button variant="ghost" size="sm" onClick={() => setEventDateFilter("")}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </MuiCardContent>
          </MuiCard>

          {(() => {
            const filteredEvents = events.filter((ev: any) => {
              const matchesPayment = paymentFilter === "all" || getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []) === paymentFilter;
              const matchesDate = !eventDateFilter || ev.event_date === eventDateFilter;
              return matchesPayment && matchesDate;
            });
            const totalPages = Math.max(1, Math.ceil(filteredEvents.length / BOOKINGS_PAGE_SIZE));
            const page = Math.min(currentPage, totalPages);
            const paginatedEvents = filteredEvents.slice((page - 1) * BOOKINGS_PAGE_SIZE, page * BOOKINGS_PAGE_SIZE);

            if (isLoading) return <><CardListSkeleton count={3} /><TableSkeleton columns={7} rows={4} /></>;
            if (filteredEvents.length === 0) return (
              <MuiCard variant="outlined">
                <MuiCardContent className="flex flex-col items-center justify-center py-16">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet/10 mb-4">
                    <Calendar className="h-8 w-8 text-primary/40" />
                  </div>
                  <p className="font-medium text-foreground">{t.common.noData}</p>
                  <p className="text-sm text-muted-foreground mt-1">No events match your filters</p>
                  {canWrite && (
                    <Button className="mt-5 gap-1.5" size="sm" onClick={openNew}>
                      <Calendar className="h-4 w-4" />
                      {b.newEvent}
                    </Button>
                  )}
                </MuiCardContent>
              </MuiCard>
            );

            return (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {paginatedEvents.map((ev: any) => {
                  const eventPaymentStatus = getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []);
                  const badgeCfg = paymentBadgeConfig[eventPaymentStatus] || paymentBadgeConfig.unpaid;
                  return (
                  <MuiCard variant="outlined" key={ev.id} className="overflow-hidden animate-card-in card-interactive">
                    <div className="divide-y divide-border/50">
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{(b.types as any)[ev.event_type] ?? ev.event_type}</p>
                              {showFinancialFields && (
                                <Chip
                                  label={badgeCfg.label}
                                  variant="outlined"
                                  size="small"
                                  className={`font-medium ${badgeCfg.className}`}
                                  sx={{ height: 20, fontSize: "10px", "& .MuiChip-label": { px: "6px" } }}
                                />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{ev.clients?.name ?? ev.client_name ?? "No client"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">{b.date}</p>
                            <p className="font-medium">{format(new Date(ev.event_date), "MMM d, yyyy")}</p>
                            {ev.hebrew_date && <p className="text-xs text-muted-foreground mt-0.5">{ev.hebrew_date}</p>}
                          </div>
                          <div>
                            {showFinancialFields ? (
                              <>
                                <p className="text-muted-foreground text-xs">{b.totalPrice}</p>
                                <p className="font-semibold">${ev.total_price ?? 0}</p>
                                {eventPaymentStatus !== "paid" && (Number(ev.total_price) || 0) > 0 && (
                                  <p className="text-xs text-amber/70 mt-0.5">
                                    Due: ${Math.max((Number(ev.total_price) || 0) - (Number(ev.deposit) || 0), 0).toLocaleString()}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-muted-foreground text-xs">{b.status}</p>
                                <p className="font-semibold">Assigned booking</p>
                              </>
                            )}
                          </div>
                        </div>
                        {ev.venue && <p className="text-xs text-muted-foreground truncate">{ev.venue}</p>}
                      </div>
                      <div className="flex gap-2 px-4 py-2.5">
                        <Button variant="outline" size="sm" className="flex-1 h-9 text-xs gap-1" onClick={() => setViewing(ev)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        {canWrite && (
                          <Button variant="outline" size="sm" className="flex-1 h-9 text-xs gap-1" onClick={() => openEdit(ev)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                        {canWrite && (
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTargetId(ev.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </MuiCard>
                )})}
              </div>

              {/* Desktop Table */}
              <MuiCard variant="outlined" className="hidden md:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                          <TableHead>{b.date}</TableHead>
                          <TableHead>{b.hebrewDate}</TableHead>
                          <TableHead>{b.eventType}</TableHead>
                          <TableHead>{b.client}</TableHead>
                          <TableHead>{b.venue}</TableHead>
                          {showFinancialFields && <TableHead className="text-right">{b.totalPrice}</TableHead>}
                          {showFinancialFields && <TableHead className="text-right">{b.balanceDue}</TableHead>}
                          {showFinancialFields && <TableHead>{b.status}</TableHead>}
                        {canWrite ? <TableHead className="w-auto" /> : <TableHead className="w-20" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEvents.map((ev: any) => {
                        const eventPaymentStatus = getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []);
                        return (
                        <TableRow key={ev.id} className="animate-row-in row-interactive group">
                          <TableCell className="whitespace-nowrap">{format(new Date(ev.event_date), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ev.hebrew_date ?? "—"}</TableCell>
                          <TableCell>{(b.types as any)[ev.event_type] ?? ev.event_type}</TableCell>
                          <TableCell>{ev.clients?.name ?? ev.client_name ?? "—"}</TableCell>
                          <TableCell>{ev.venue ?? "—"}</TableCell>
                          {showFinancialFields && <TableCell className="text-right font-medium">${ev.total_price ?? 0}</TableCell>}
                          {showFinancialFields && (
                            <TableCell className="text-right font-medium">
                              {eventPaymentStatus === "paid" ? "$0" : `$${Math.max((Number(ev.total_price) || 0) - (Number(ev.deposit) || 0), 0).toLocaleString()}`}
                            </TableCell>
                          )}
                          {showFinancialFields && (
                            <TableCell>
                              <Chip
                                label={(b.paymentStatus as any)[eventPaymentStatus]}
                                variant="outlined"
                                size="small"
                                className={`font-medium ${statusColor(eventPaymentStatus)}`}
                                sx={{ height: 22, fontSize: "11px", "& .MuiChip-label": { px: "8px" } }}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setViewing(ev)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                              </Button>
                              {canWrite && (
                                <>
                                  <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openEdit(ev)}>
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openOrCreateInvoice(ev)}>
                                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Invoice
                                  </Button>
                                  {showExpenses && (
                                    <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setExpenseDialogEvent(ev)}>
                                      <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Expenses
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(ev.id)}>
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>
              </MuiCard>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
            );
          })()}
        </TabsContent>

        <TabsContent value="calendar">
          <BookingCalendar events={events} onEventClick={(ev) => setViewing(ev)} />
        </TabsContent>

        {role !== "member" && (
          <TabsContent value="requests">
            <BookingRequests />
          </TabsContent>
        )}
      </Tabs>

      {/* Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex flex-col w-full sm:max-w-2xl max-h-[90vh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>{editing ? t.common.edit : t.common.create} {b.title.toLowerCase()}</DialogTitle>
            <DialogDescription>{editing ? "Update event details" : "Create a new booking event"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
              e.preventDefault();
              if (!form.event_date) {
                toast({ title: "Date is required", variant: "destructive" });
                return;
              }
              if (!editing && form.event_date < todayIso) {
                toast({ title: "Past dates are not allowed", variant: "destructive" });
                return;
              }
              if (!form.event_type) {
                toast({ title: "Event type is required", variant: "destructive" });
                return;
              }
              saveMutation.mutate(form);
            }} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Event Details */}
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
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
                    <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((cl) => (
                          <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canWrite && (
                      <Button type="button" variant="outline" size="icon" onClick={() => setClientDialogOpen(true)} title="Quick add client">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                    {form.client_id && editing && (
                      <Button type="button" variant="outline" size="icon" onClick={() => {
                        const cl = clients.find((c) => c.id === form.client_id);
                        setHistoryClientId(form.client_id);
                        setHistoryClientName(cl?.name ?? "Client");
                      }} title="View Client History">
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{b.date} *</Label>
                  <Input
                    type="date"
                    required
                    min={eventDateMin}
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{b.hebrewDate}</Label>
                  <Input disabled value={form.event_date ? toHebrewDate(form.event_date) : ""} className="bg-muted text-sm" />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
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

            {showFinancialFields && (
                <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <SectionLabel icon={DollarSign} title="Financials" />
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
                        <Select value={form.deposit_status} onValueChange={(v) => setForm({ ...form, deposit_status: v })}>
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
                      <Input disabled value={Math.max((Number(form.balance_due) || 0) - editingPaymentsTotal, 0)} className="bg-muted" />
                      {editingPaymentsTotal > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          ${Number(form.balance_due || 0).toLocaleString()} less ${editingPaymentsTotal.toLocaleString()} in recorded payments
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
                        const balanceDue = v === "paid" ? 0 : rawBalance;
                        if (v === "paid") {
                          const outstanding = Math.max(rawBalance - editingPaymentsTotal, 0);
                          if (outstanding > 0) {
                            toast({
                              title: "Heads up",
                              description: `$${outstanding.toLocaleString()} still appears unpaid based on the total, deposit, and recorded payments. Marking this "Paid" will set the balance due to $0.`,
                            });
                          }
                        }
                        setForm({ ...form, payment_status: v, balance_due: String(balanceDue) });
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{(b.paymentStatus as any)[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{b.dueDate}</Label>
                      <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                    </div>
                  </div>
                </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5 rounded-xl border bg-muted/30 p-4">
              <Label className="text-sm">{b.notes}</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="resize-none" />
            </div>

            {/* Event Timing */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <EventTimingSection eventType={form.event_type} timing={timing} onChange={setTiming} canWrite={canWrite} />
            </div>

            {/* Extended sections — only for existing events */}
            {editing && tenantId && (
              <>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <ColleaguesSection eventId={editing.id} canWrite={canWrite} tenantId={tenantId} />
                </div>
                {showFinancialFields && (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <PaymentsSection eventId={editing.id} canWrite={canWrite} />
                  </div>
                )}
                <div className="rounded-xl border bg-muted/30 p-4">
                  <SongsSection eventId={editing.id} canWrite={canWrite} />
                </div>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <AttachmentsSection eventId={editing.id} canWrite={canWrite} />
                </div>
                {showExpenses && (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <ExpensesProfitSection eventId={editing.id} canWrite={canWrite} totalRevenue={Number(form.total_price) || 0} />
                  </div>
                )}
                {role === "owner" && (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <AgentAssignmentSection eventId={editing.id} canWrite={canWrite} totalPrice={Number(form.total_price) || 0} />
                  </div>
                )}
              </>
            )}

          </div>
          <div className="shrink-0 border-t bg-background px-6 py-4">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-gold text-primary-foreground font-semibold">
                {saveMutation.isPending ? t.common.loading : t.common.save}
              </Button>
            </DialogFooter>
          </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Booking Dialog */}
      <ViewBookingDialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} event={viewing} />

      {/* Expense Dialog (standalone from table action) */}
      {expenseDialogEvent && (
        <Dialog open={!!expenseDialogEvent} onOpenChange={(o) => !o && setExpenseDialogEvent(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Expenses & Profit</DialogTitle>
              <DialogDescription>
                {(b.types as any)[expenseDialogEvent.event_type] ?? expenseDialogEvent.event_type} — {format(new Date(expenseDialogEvent.event_date), "MMM d, yyyy")}
              </DialogDescription>
            </DialogHeader>
            <ExpensesProfitSection eventId={expenseDialogEvent.id} canWrite={canWrite} totalRevenue={expenseDialogEvent.total_price ?? 0} />
          </DialogContent>
        </Dialog>
      )}

      {/* Inline Client Dialog */}
      {tenantId && (
        <InlineClientDialog
          open={clientDialogOpen}
          onOpenChange={setClientDialogOpen}
          tenantId={tenantId}
          onClientCreated={(id) => setForm(prev => ({ ...prev, client_id: id }))}
        />
      )}

      {historyClientId && (
        <ClientHistoryDialog
          open={!!historyClientId}
          onOpenChange={(o) => !o && setHistoryClientId(null)}
          clientId={historyClientId}
          clientName={historyClientName}
        />
      )}

      <ConfirmDestructiveDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title={b.confirmDeleteTitle}
        description={b.confirmDeleteDescription}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        pendingLabel={t.common.deleting}
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); }}
      />
    </div>
  );
}
