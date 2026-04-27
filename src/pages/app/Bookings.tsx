import { useState, useEffect, useCallback } from "react";
import { CardListSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toHebrewDate } from "@/lib/hebrewDate";
import { getEventPaymentStatus } from "@/lib/eventPaymentStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Calendar, Pencil, Trash2, FileText, UserPlus, Eye, DollarSign, History, CalendarDays, List } from "lucide-react";
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

const EVENT_TYPES = ["wedding", "bar_mitzvah", "bat_mitzvah", "corporate", "concert", "other"] as const;
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

const emptyTiming: TimingFields = {
  chuppah_time: "", meal_time: "", first_dance_time: "", second_dance_time: "", mitzvah_tanz_time: "", event_start_time: "",
};

const emptyForm = {
  client_id: "", event_date: "", event_type: "wedding" as string, venue: "", location: "",
  total_price: "", deposit: "", balance_due: "", payment_status: "unpaid" as string,
  deposit_status: "unpaid" as string,
  due_date: "", notes: "", travel_fee: "",
};

export default function Bookings() {
  const { t } = useLanguage();
  const b = t.app.bookings;
  const { tenantId } = useTenantId();
  const { canWrite, role, isLoading: roleLoading } = useUserRole();
  const { canAccess } = useSubscription();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [eventDateFilter, setEventDateFilter] = useState<string>("");
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
        const { data, error } = await (supabase.rpc as any)("get_member_bookings", {
          _tenant_id: tenantId!,
        });
        if (error) throw error;
        return data ?? [];
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
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`events-realtime-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `tenant_id=eq.${tenantId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["events", tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, qc]);

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

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const hebrewDate = values.event_date ? toHebrewDate(values.event_date) : null;
      const travelFee = values.travel_fee ? Number(values.travel_fee) : 0;
      const totalPrice = values.total_price ? Number(values.total_price) : 0;
      const deposit = values.deposit ? Number(values.deposit) : 0;
      const balanceDue = Math.max(totalPrice - deposit, 0);

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
      const { data, isNew, wasStatus } = result;
      qc.invalidateQueries({ queryKey: ["events", tenantId] });

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
        const savedBalance = data.payment_status === "paid" ? 0 : Math.max(savedTotal - savedDep, 0);
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", tenantId] });
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
  }, [searchParams, events]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setTiming(emptyTiming); setDialogOpen(true); };
  const openEdit = (ev: any) => {
    setEditing(ev);
    const total = Number(ev.total_price) || 0;
    const dep = Number(ev.deposit) || 0;
    const computedBalance = ev.payment_status === "paid" ? 0 : Math.max(total - dep, 0);
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

  const statusColor = (s: string) => {
    switch (s) {
      case "paid": return "bg-emerald-500/15 text-emerald-700 border-emerald-200";
      case "partial": return "bg-amber-500/15 text-amber-700 border-amber-200";
      default: return "bg-destructive/10 text-destructive border-destructive/20";
    }
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

  const updateFinancials = (field: "total_price" | "deposit" | "travel_fee", value: string) => {
    const updated = { ...form, [field]: value };
    const total = Number(updated.total_price) || 0;
    const dep = Number(updated.deposit) || 0;
    // Balance due = collectable money only (total price - deposit), travel fee is our expense
    updated.balance_due = String(Math.max(total - dep, 0));
    setForm(updated);
  };

  const showExpenses = canAccess("expenses_profit") && role !== "member";
  const showFinancialFields = role !== "member";
  const pendingRequestCount = useBookingRequestCount(role !== "member" ? tenantId : null);
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const eventDateMin = editing && form.event_date && form.event_date < todayIso ? form.event_date : todayIso;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{b.title}</h1>
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
          {/* Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex gap-2 flex-wrap">
              {["all", "unpaid", "partial", "paid"].map((status) => (
                <Button
                  key={status}
                  variant={paymentFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentFilter(status)}
                  className={paymentFilter === status ? "" : ""}
                >
                  {status === "all" ? "All" : (b.paymentStatus as any)[status] ?? status}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bookings-date-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                {b.date}
              </Label>
              <div>
                <Input
                  id="bookings-date-filter"
                  type="date"
                  value={eventDateFilter}
                  onChange={(e) => setEventDateFilter(e.target.value)}
                  className="w-full md:w-[180px]"
                />
              </div>
              {eventDateFilter && (
                <Button variant="outline" size="sm" onClick={() => setEventDateFilter("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {(() => {
            const filteredEvents = events.filter((ev: any) => {
              const matchesPayment = paymentFilter === "all" || getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []) === paymentFilter;
              const matchesDate = !eventDateFilter || ev.event_date === eventDateFilter;
              return matchesPayment && matchesDate;
            });

            if (isLoading) return <><CardListSkeleton count={3} /><TableSkeleton columns={7} rows={4} /></>;
            if (filteredEvents.length === 0) return (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Calendar className="mb-3 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground">{t.common.noData}</p>
                </CardContent>
              </Card>
            );

            return (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {filteredEvents.map((ev: any) => {
                  const eventPaymentStatus = getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []);
                  return (
                  <Card key={ev.id} className="overflow-hidden animate-card-in card-interactive">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{(b.types as any)[ev.event_type] ?? ev.event_type}</p>
                          <p className="text-sm text-muted-foreground">{ev.clients?.name ?? ev.client_name ?? "No client"}</p>
                        </div>
                        {showFinancialFields ? (
                          <Badge variant="outline" className={statusColor(eventPaymentStatus)}>
                            {(b.paymentStatus as any)[eventPaymentStatus]}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">{b.date}</p>
                          <p className="font-medium">{format(new Date(ev.event_date), "MMM d, yyyy")}</p>
                          {ev.hebrew_date && <p className="text-xs text-muted-foreground">{ev.hebrew_date}</p>}
                        </div>
                        <div>
                          {showFinancialFields ? (
                            <>
                              <p className="text-muted-foreground text-xs">{b.totalPrice}</p>
                              <p className="font-semibold">${ev.total_price ?? 0}</p>
                              {eventPaymentStatus !== "paid" && (Number(ev.total_price) || 0) > 0 && (
                                <p className="text-xs text-amber-600">
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
                      {ev.venue && <p className="text-sm text-muted-foreground truncate">📍 {ev.venue}</p>}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => setViewing(ev)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Button>
                        {canWrite && (
                          <>
                            <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => openEdit(ev)}>
                              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="h-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(ev.id)}>
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )})}
              </div>

              {/* Desktop Table */}
              <Card className="hidden md:block">
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
                      {filteredEvents.map((ev: any) => {
                        const eventPaymentStatus = getEventPaymentStatus(ev, invoicesByEventId[ev.id] ?? []);
                        return (
                        <TableRow key={ev.id} className="animate-row-in row-interactive">
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
                              <Badge variant="outline" className={statusColor(eventPaymentStatus)}>
                                {(b.paymentStatus as any)[eventPaymentStatus]}
                              </Badge>
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
                                    <FileText className="mr-1.5 h-3.5 w-3.5 text-primary" /> Invoice
                                  </Button>
                                  {showExpenses && (
                                    <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setExpenseDialogEvent(ev)}>
                                      <DollarSign className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Expenses
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
              </Card>
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
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.common.edit : t.common.create} {b.title.toLowerCase()}</DialogTitle>
            <DialogDescription>{editing ? "Update event details" : "Create a new booking event"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
              e.preventDefault();
              if (!form.event_date) {
                toast({ title: "Date is required", variant: "destructive" });
                return;
              }
              if (form.event_date < todayIso) {
                toast({ title: "Past dates are not allowed", variant: "destructive" });
                return;
              }
              if (!form.event_type) {
                toast({ title: "Event type is required", variant: "destructive" });
                return;
              }
              saveMutation.mutate(form);
            }} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{b.eventType} *</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((et) => (
                      <SelectItem key={et} value={et}>{(b.types as any)[et]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{b.client}</Label>
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
              <div className="space-y-2">
                <Label>{b.date} *</Label>
                <Input
                  type="date"
                  required
                  min={eventDateMin}
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{b.hebrewDate}</Label>
                <Input disabled value={form.event_date ? toHebrewDate(form.event_date) : ""} className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>{b.venue}</Label>
                <VenueAutocomplete
                  value={form.venue}
                  onChange={(venue, location) => setForm({ ...form, venue, location: location || form.location })}
                  placeholder="Search venue..."
                />
              </div>
              <div className="space-y-2">
              <Label>{b.location}</Label>
                <div className="flex gap-1.5">
                  <Input className="flex-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Full address (auto-filled)" />
                  {(form.location || form.venue) && <NavigateButton address={form.location || form.venue} size="icon" />}
                </div>
              </div>
              {showFinancialFields && (
                <>
                  <div className="space-y-2">
                    <Label>{b.totalPrice}</Label>
                    <Input type="number" min="0" value={form.total_price} onChange={(e) => updateFinancials("total_price", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Travel Fee</Label>
                    <Input type="number" min="0" value={form.travel_fee} onChange={(e) => updateFinancials("travel_fee", e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>{b.deposit}</Label>
                    <Input type="number" min="0" value={form.deposit} onChange={(e) => updateFinancials("deposit", e.target.value)} />
                  </div>
                  {Number(form.deposit) > 0 && (
                    <div className="space-y-2">
                      <Label>Deposit Status</Label>
                      <Select value={form.deposit_status} onValueChange={(v) => setForm({ ...form, deposit_status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{b.balanceDue}</Label>
                    <Input disabled value={form.balance_due} className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Booking Status</Label>
                    <Select value={form.payment_status} onValueChange={(v) => {
                      const total = Number(form.total_price) || 0;
                      const dep = Number(form.deposit) || 0;
                      const balanceDue = v === "paid" ? 0 : Math.max(total - dep, 0);
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
                  <div className="space-y-2">
                    <Label>{b.dueDate}</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>{b.notes}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {/* Event Timing */}
            <Separator />
            <EventTimingSection eventType={form.event_type} timing={timing} onChange={setTiming} canWrite={canWrite} />

            {/* Extended sections — only for existing events */}
            {editing && tenantId && (
              <>
                <Separator />
                <ColleaguesSection eventId={editing.id} canWrite={canWrite} tenantId={tenantId} />
                {showFinancialFields && (
                  <>
                    <Separator />
                    <PaymentsSection eventId={editing.id} canWrite={canWrite} />
                  </>
                )}
                <Separator />
                <SongsSection eventId={editing.id} canWrite={canWrite} />
                <Separator />
                <AttachmentsSection eventId={editing.id} canWrite={canWrite} />
                {showExpenses && (
                  <>
                    <Separator />
                    <ExpensesProfitSection eventId={editing.id} canWrite={canWrite} totalRevenue={Number(form.total_price) || 0} />
                  </>
                )}
                {role === "owner" && (
                  <>
                    <Separator />
                    <AgentAssignmentSection eventId={editing.id} canWrite={canWrite} totalPrice={Number(form.total_price) || 0} />
                  </>
                )}
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-gold text-primary-foreground font-semibold">
                {saveMutation.isPending ? t.common.loading : t.common.save}
              </Button>
            </DialogFooter>
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
          onClientCreated={(id) => setForm({ ...form, client_id: id })}
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
