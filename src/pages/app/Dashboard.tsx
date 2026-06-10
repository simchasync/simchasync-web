import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, Button, IconButton, Chip, Divider } from "@mui/material";
import { StatCardsSkeleton } from "@/components/ui/page-skeletons";
import { StatCard, SectionHeader } from "@/components/ui/stat-card";
import ViewBookingDialog from "@/components/bookings/ViewBookingDialog";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardStats,
  paymentStatusBadge,
  type DashboardEvent,
  type DashboardInvoice,
  type BookingAgentCommissionRow,
} from "@/lib/dashboardAnalytics";
import {
  Calendar, DollarSign, TrendingDown, AlertCircle, Eye, Pencil,
  ArrowUpRight, UserPlus, FileText, Wallet, BarChart3,
} from "lucide-react";

const statusBadge = paymentStatusBadge;

function QuickActions() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const actions = [
    { label: t.app.dashboard.newBooking, icon: Calendar, onClick: () => navigate("/app/bookings"), color: "text-primary" },
    { label: t.app.clients.newClient, icon: UserPlus, onClick: () => navigate("/app/clients"), color: "text-cyan-500" },
    { label: t.app.invoices.newInvoice, icon: FileText, onClick: () => navigate("/app/invoices"), color: "text-amber-500" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.label}
          variant="outlined"
          size="small"
          onClick={a.onClick}
          startIcon={<a.icon className={`h-4 w-4 ${a.color}`} />}
          className="h-9 text-xs"
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function UpcomingEvents({ events, onView, onEdit }: {
  events: DashboardEvent[];
  onView: (e: DashboardEvent) => void;
  onEdit: (e: DashboardEvent) => void;
}) {
  const { t } = useLanguage();
  const d = t.app.dashboard;
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground">{d.noEvents}</p>
        <p className="text-xs mt-0.5">{d.noEventsHint}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border/50">
      {events.slice(0, 5).map((ev: DashboardEvent) => {
        const badge = statusBadge[ev.payment_status] ?? statusBadge.unpaid;
        return (
          <div key={ev.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/30 -mx-1 px-1 rounded-lg">
            <div className="flex flex-col items-center justify-center w-10 h-11 rounded-lg bg-gradient-to-b from-primary/10 to-primary/5 shrink-0 border border-primary/10">
              <span className="text-[9px] font-bold text-primary uppercase leading-tight">{format(new Date(ev.event_date), "MMM")}</span>
              <span className="text-sm font-bold text-foreground leading-tight -mt-px">{format(new Date(ev.event_date), "d")}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium text-sm truncate">{(t.app.bookings.types as any)[ev.event_type] ?? ev.event_type}</p>
                <Chip
                  label={badge.label}
                  variant="outlined"
                  size="small"
                  className={`font-medium ${badge.className}`}
                  sx={{ height: 16, fontSize: "10px", "& .MuiChip-label": { px: "6px" } }}
                />
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.clients?.name ?? d.noClient}{ev.venue ? ` · ${ev.venue}` : ""}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <IconButton size="small" className="text-muted-foreground hover:text-foreground" sx={{ width: 32, height: 32 }} onClick={() => onView(ev)} title={t.common.view}>
                <Eye className="h-4 w-4" />
              </IconButton>
              <IconButton size="small" className="text-muted-foreground hover:text-foreground" sx={{ width: 32, height: 32 }} onClick={() => onEdit(ev)} title={t.common.edit}>
                <Pencil className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentInvoices({ invoices }: { invoices: DashboardInvoice[] }) {
  const { t } = useLanguage();
  const d = t.app.dashboard;
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground">{d.noInvoices}</p>
        <p className="text-xs mt-0.5">{d.noInvoicesHint}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border/50">
      {invoices.slice(0, 5).map((inv: DashboardInvoice) => {
        const badge = inv.status === "paid"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200"
          : inv.status === "sent"
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200"
            : "bg-muted text-muted-foreground border-border";
        return (
          <div key={inv.id} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/30 -mx-1 px-1 rounded-lg">
            <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${inv.status === "paid" ? "bg-emerald-500/10" : "bg-muted"}`}>
              <Wallet className={`h-4 w-4 ${inv.status === "paid" ? "text-emerald-500" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {inv.description || `Invoice #${inv.id.slice(0, 8)}`}
              </p>
              <p className="text-xs text-muted-foreground">
                ${inv.amount?.toLocaleString()} · {inv.created_at ? format(new Date(inv.created_at), "MMM d") : ""}
              </p>
            </div>
            <Chip
              label={inv.status}
              variant="outlined"
              size="small"
              className={`font-medium ${badge}`}
              sx={{ height: 16, fontSize: "10px", "& .MuiChip-label": { px: "6px" } }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const d = t.app.dashboard;
  const { tenantId } = useTenantId();
  const { isSocialOnly } = useUserRole();
  const { canAccess, plan } = useSubscription();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<any>(null);
  const [viewingMode, setViewingMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`dashboard-events-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `tenant_id=eq.${tenantId}` }, () => qc.invalidateQueries({ queryKey: ["events", tenantId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `tenant_id=eq.${tenantId}` }, () => qc.invalidateQueries({ queryKey: ["invoices", tenantId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, qc]);

  const showProfitAnalytics = canAccess("expenses_profit") && !isSocialOnly;
  const hasBillAccess = plan !== "none" && !isSocialOnly;

  const { data: events = [], isLoading } = useQuery<DashboardEvent[]>({
    queryKey: ["events", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*, clients(name)").eq("tenant_id", tenantId!).order("event_date", { ascending: true });
      if (error) throw error;
      return data as DashboardEvent[];
    },
    enabled: !!tenantId && hasBillAccess,
  });

  const { data: invoices = [] } = useQuery<DashboardInvoice[]>({
    queryKey: ["invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as DashboardInvoice[];
    },
    enabled: !!tenantId && hasBillAccess,
  });

  const eventIds = useMemo(() => events.map((event) => event.id), [events]);

  const { data: allExpenses = [] } = useQuery<Database["public"]["Tables"]["event_expenses"]["Row"][]>({
    queryKey: ["all-event-expenses", tenantId, eventIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_expenses").select("amount, event_id").in("event_id", eventIds);
      if (error) throw error;
      return (data ?? []) as Database["public"]["Tables"]["event_expenses"]["Row"][];
    },
    enabled: !!tenantId && showProfitAnalytics && eventIds.length > 0,
  });

  const { data: allColleagueCosts = [] } = useQuery<Database["public"]["Tables"]["event_colleagues"]["Row"][]>({
    queryKey: ["all-colleague-costs", tenantId, eventIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_colleagues").select("price, event_id, payment_responsibility").eq("payment_responsibility", "paid_by_me").in("event_id", eventIds);
      if (error) throw error;
      return (data ?? []) as Database["public"]["Tables"]["event_colleagues"]["Row"][];
    },
    enabled: !!tenantId && showProfitAnalytics && eventIds.length > 0,
  });

  const { data: allCommissions = [] } = useQuery<BookingAgentCommissionRow[]>({
    queryKey: ["all-commissions", tenantId, eventIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents")
        .select("commission_amount, agents!inner(tenant_id), event_id")
        .eq("agents.tenant_id", tenantId!)
        .in("event_id", eventIds);
      if (error) throw error;
      return (data ?? []) as BookingAgentCommissionRow[];
    },
    enabled: !!tenantId && showProfitAnalytics && eventIds.length > 0,
  });

  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => startOfMonth(now), [now]);
  const monthEnd = useMemo(() => endOfMonth(now), [now]);

  const upcoming = useMemo(
    () => events.filter((event) => new Date(event.event_date) >= now).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()),
    [events, now],
  );

  const thisMonthEvents = useMemo(
    () => events.filter((event) => {
      const date = new Date(event.event_date);
      return date >= monthStart && date <= monthEnd;
    }),
    [events, monthStart, monthEnd],
  );

  const analytics = useMemo(
    () =>
      getDashboardStats({
        events,
        invoices,
        expenses: allExpenses,
        colleagueCosts: allColleagueCosts,
        commissions: allCommissions,
        now,
      }),
    [events, invoices, allExpenses, allColleagueCosts, allCommissions, now],
  );

  const {
    totalRevenue,
    revenueReceived,
    outstanding,
    thisMonthRevenue,
    totalExpenses,
    netProfit,
    avgProfitPerBooking,
    totalBookings,
    paidBookings,
    unpaidBookings,
    invoicePaid,
    invoicePaidCount,
  } = analytics;

  const recentInvoices = invoices.slice(0, 10);

  if (isSocialOnly) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">{d.title}</h1>
        <Card variant="outlined">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-display font-semibold mb-1">{d.socialTitle}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{d.socialHint}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight mb-0.5">{d.title}</h1>
          <p className="text-sm text-muted-foreground">
            {format(now, "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <QuickActions />
      </div>

      {isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : (
        <>
          {/* Stat Cards */}
          <section>
            <SectionHeader title={d.overview} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <StatCard label={d.totalRevenue} value={`$${totalRevenue.toLocaleString()}`} sub={`$${revenueReceived.toLocaleString()} ${d.received}`} icon={DollarSign} accent="emerald" />
              <StatCard label={d.outstanding} value={`$${outstanding.toLocaleString()}`} sub={d.unpaidBookings.replace("{count}", String(unpaidBookings))} icon={AlertCircle} accent="amber" />
              <StatCard label={d.thisMonth} value={`$${thisMonthRevenue.toLocaleString()}`} sub={d.eventsCount.replace("{count}", String(thisMonthEvents.length))} icon={Calendar} accent="cyan" />
              <StatCard label={d.totalBookings} value={`${totalBookings}`} sub={d.paidCount.replace("{count}", String(paidBookings))} icon={BarChart3} accent="violet" />
            </div>
          </section>

          {/* Upcoming + Invoices */}
          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <SectionHeader title={d.upcoming} count={upcoming.length} />
              <Card variant="outlined" className="animate-card-in">
                <CardContent className="p-4 md:p-5">
                  <UpcomingEvents
                    events={upcoming}
                    onView={(ev) => { setViewing(ev); setViewingMode("view"); }}
                    onEdit={(ev) => { setViewing(ev); setViewingMode("edit"); }}
                  />
                  {upcoming.length > 5 && (
                    <>
                      <Divider className="my-3" />
                      <Button variant="text" size="small" fullWidth className="text-xs text-muted-foreground hover:text-foreground" endIcon={<ArrowUpRight className="h-3 w-3" />} onClick={() => navigate("/app/bookings")}>
                        {d.viewAllEvents.replace("{count}", String(upcoming.length))}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <SectionHeader title={d.recentInvoices} count={recentInvoices.length} />
              <Card variant="outlined" className="animate-card-in">
                <CardContent className="p-4 md:p-5">
                  <RecentInvoices invoices={recentInvoices} />
                  {invoices.length > 5 && (
                    <>
                      <Divider className="my-3" />
                      <Button variant="text" size="small" fullWidth className="text-xs text-muted-foreground hover:text-foreground" endIcon={<ArrowUpRight className="h-3 w-3" />} onClick={() => navigate("/app/invoices")}>
                        {d.viewAllInvoices.replace("{count}", String(invoices.length))}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Profit Analytics — Full Plan Only */}
          {showProfitAnalytics && (
            <section>
              <SectionHeader title={d.profitAnalytics} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatCard label={d.totalExpenses} value={`$${totalExpenses.toLocaleString()}`} icon={TrendingDown} accent="rose" />
                <StatCard label={d.netProfit} value={`${netProfit >= 0 ? "+" : ""}$${netProfit.toLocaleString()}`} icon={ArrowUpRight} accent={netProfit >= 0 ? "emerald" : "rose"} />
                <StatCard label={d.avgProfitPerBooking} value={`$${avgProfitPerBooking.toLocaleString()}`} icon={DollarSign} accent="violet" />
                <StatCard label={d.invoicesPaid} value={`$${invoicePaid.toLocaleString()}`} sub={d.invoicesCount.replace("{count}", String(invoicePaidCount))} icon={Wallet} accent="cyan" />
              </div>
            </section>
          )}
        </>
      )}

      <ViewBookingDialog
        open={!!viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
        event={viewing}
        defaultMode={viewingMode}
        onSaved={() => qc.invalidateQueries({ queryKey: ["events", tenantId] })}
      />
    </div>
  );
}
