import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCardsSkeleton } from "@/components/ui/page-skeletons";
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

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; icon: typeof DollarSign; accent: string;
}) {
  const accentMap: Record<string, string> = {
    emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    cyan: "border-cyan-400/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    violet: "border-violet-400/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  const a = accentMap[accent] || accentMap.emerald;
  return (
    <Card className="animate-card-in overflow-hidden border-t-[3px]" style={{ borderTopColor: `hsl(var(--${accent === "emerald" ? "142 76% 36%" : accent === "amber" ? "35 92% 50%" : accent === "cyan" ? "187 85% 42%" : accent === "violet" ? "263 70% 60%" : "340 82% 52%"}) / 0.3)` }}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${a.split(" ")[1]}`}>
            <Icon className={`h-4 w-4 ${a.split(" ").slice(2).join(" ")}`} />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const navigate = useNavigate();
  const actions = [
    { label: "New Booking", icon: Calendar, onClick: () => navigate("/app/bookings"), color: "text-primary" },
    { label: "New Client", icon: UserPlus, onClick: () => navigate("/app/clients"), color: "text-cyan-500" },
    { label: "New Invoice", icon: FileText, onClick: () => navigate("/app/invoices"), color: "text-amber-500" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.label} variant="outline" size="sm" onClick={a.onClick} className="h-9 gap-1.5 text-xs">
          <a.icon className={`h-4 w-4 ${a.color}`} />
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-1 w-6 rounded-full bg-gradient-to-r from-primary to-primary/40" />
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
      {count !== undefined && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">{count}</Badge>
      )}
    </div>
  );
}

function UpcomingEvents({ events, onView, onEdit }: {
  events: DashboardEvent[];
  onView: (e: DashboardEvent) => void;
  onEdit: (e: DashboardEvent) => void;
}) {
  const { t } = useLanguage();
  if (events.length === 0) {
    return (
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Calendar className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No upcoming events</p>
          <p className="text-xs mt-0.5">Create your first booking to get started</p>
        </div>
      </CardContent>
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
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-medium ${badge.className}`}>{badge.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.clients?.name ?? "No client"}{ev.venue ? ` · ${ev.venue}` : ""}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => onView(ev)} title="View">
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => onEdit(ev)} title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentInvoices({ invoices }: { invoices: DashboardInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No invoices yet</p>
          <p className="text-xs mt-0.5">Create a booking with a deposit to auto-generate invoices</p>
        </div>
      </CardContent>
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
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-medium ${badge}`}>
              {inv.status}
            </Badge>
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
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">Dashboard</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-display font-semibold mb-1">Social Media Dashboard</h2>
            <p className="text-sm text-muted-foreground max-w-sm">Analytics and performance metrics will appear here once available.</p>
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
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">{d.title}</h1>
          </div>
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
            <SectionHeader title="Overview" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} sub={`$${revenueReceived.toLocaleString()} received`} icon={DollarSign} accent="emerald" />
              <StatCard label="Outstanding" value={`$${outstanding.toLocaleString()}`} sub={`${unpaidBookings} unpaid bookings`} icon={AlertCircle} accent="amber" />
              <StatCard label="This Month" value={`$${thisMonthRevenue.toLocaleString()}`} sub={`${thisMonthEvents.length} event(s)`} icon={Calendar} accent="cyan" />
              <StatCard label="Total Bookings" value={`${totalBookings}`} sub={`${paidBookings} paid`} icon={BarChart3} accent="violet" />
            </div>
          </section>

          {/* Upcoming + Invoices */}
          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <SectionHeader title={d.upcoming} count={upcoming.length} />
              <Card className="animate-card-in">
                <CardContent className="p-4 md:p-5">
                  <UpcomingEvents
                    events={upcoming}
                    onView={(ev) => { setViewing(ev); setViewingMode("view"); }}
                    onEdit={(ev) => { setViewing(ev); setViewingMode("edit"); }}
                  />
                  {upcoming.length > 5 && (
                    <>
                      <Separator className="my-3" />
                      <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => navigate("/app/bookings")}>
                        View all {upcoming.length} events
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <SectionHeader title="Recent Invoices" count={recentInvoices.length} />
              <Card className="animate-card-in">
                <CardContent className="p-4 md:p-5">
                  <RecentInvoices invoices={recentInvoices} />
                  {invoices.length > 5 && (
                    <>
                      <Separator className="my-3" />
                      <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => navigate("/app/invoices")}>
                        View all {invoices.length} invoices
                        <ArrowUpRight className="h-3 w-3" />
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
              <SectionHeader title="Profit Analytics" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatCard label="Total Expenses" value={`$${totalExpenses.toLocaleString()}`} icon={TrendingDown} accent="rose" />
                <StatCard label="Net Profit" value={`${netProfit >= 0 ? "+" : ""}$${netProfit.toLocaleString()}`} icon={ArrowUpRight} accent={netProfit >= 0 ? "emerald" : "rose"} />
                <StatCard label="Avg Profit / Booking" value={`$${avgProfitPerBooking.toLocaleString()}`} icon={DollarSign} accent="violet" />
                <StatCard label="Invoices Paid" value={`$${invoicePaid.toLocaleString()}`} sub={`${invoicePaidCount} invoices`} icon={Wallet} accent="cyan" />
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
