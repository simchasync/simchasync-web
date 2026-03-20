import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, TrendingUp, TrendingDown, AlertCircle, Eye, Pencil, Share2, Instagram, Facebook, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import ViewBookingDialog from "@/components/bookings/ViewBookingDialog";
import { StatCardsSkeleton, CardListSkeleton } from "@/components/ui/page-skeletons";

export default function Dashboard() {
  const { t } = useLanguage();
  const d = t.app.dashboard;
  const { tenantId } = useTenantId();
  const { isSocialOnly } = useUserRole();
  const { canAccess } = useSubscription();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<any>(null);

  // Realtime sync for events
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`dashboard-events-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `tenant_id=eq.${tenantId}` },
        () => { qc.invalidateQueries({ queryKey: ["events", tenantId] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, qc]);

  const showProfitAnalytics = canAccess("expenses_profit") && !isSocialOnly;

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, clients(name)")
        .eq("tenant_id", tenantId!)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !isSocialOnly,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !isSocialOnly,
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ["all-event-expenses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_expenses")
        .select("amount, event_id");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && showProfitAnalytics,
  });

  const { data: allColleagueCosts = [] } = useQuery({
    queryKey: ["all-colleague-costs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_colleagues")
        .select("price, event_id, payment_responsibility")
        .eq("payment_responsibility", "paid_by_me");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && showProfitAnalytics,
  });

  const { data: allCommissions = [] } = useQuery({
    queryKey: ["all-commissions", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents")
        .select("commission_amount, agents!inner(tenant_id)")
        .eq("agents.tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && showProfitAnalytics,
  });

  if (isSocialOnly) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Social Media Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex gap-3 mb-4">
              <Share2 className="h-10 w-10 text-muted-foreground/30" />
              <Instagram className="h-10 w-10 text-muted-foreground/30" />
              <Facebook className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">Social Media Overview</h2>
            <p className="text-muted-foreground max-w-md">
              Your social media analytics and performance metrics will appear here.
              This dashboard is coming soon in Phase 3!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const upcoming = events.filter((e: any) => new Date(e.event_date) >= now);
  const paidEvents = events.filter((e: any) => e.payment_status === "paid");
  const unpaidEvents = events.filter((e: any) => e.payment_status !== "paid");
  // Revenue = total expected from ALL bookings
  const totalRevenue = events.reduce((sum: number, e: any) => sum + (Number(e.total_price) || 0), 0);
  const revenueReceived = paidEvents.reduce((sum: number, e: any) => sum + (Number(e.total_price) || 0), 0);
  const outstanding = unpaidEvents.reduce((sum: number, e: any) => sum + Math.max((Number(e.total_price) || 0) - (Number(e.deposit) || 0), 0), 0);
  const unpaidInvoices = invoices.filter((i: any) => i.status !== "paid");
  const invoicePaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount, 0);

  const totalManualExpenses = allExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const totalColleagueCosts = allColleagueCosts.reduce((s: number, c: any) => s + (Number(c.price) || 0), 0);
  const totalCommissions = allCommissions.reduce((s: number, c: any) => s + (Number(c.commission_amount) || 0), 0);
  const totalTravelFees = events.reduce((s: number, e: any) => s + (Number(e.travel_fee) || 0), 0);
  const totalExpenses = totalManualExpenses + totalColleagueCosts + totalCommissions + totalTravelFees;
  const netProfit = totalRevenue - totalExpenses;
  const avgProfitPerBooking = events.length > 0 ? Math.round(netProfit / events.length) : 0;

  const stats = [
    {
      label: "Total Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      sub: `$${revenueReceived.toLocaleString()} received`,
      icon: DollarSign,
      gradient: "from-emerald to-cyan",
      iconBg: "bg-emerald/15",
      iconColor: "text-emerald",
      accent: "stat-card-emerald",
    },
    {
      label: d.outstanding,
      value: `$${outstanding.toLocaleString()}`,
      sub: `${unpaidInvoices.length} unpaid invoices`,
      icon: AlertCircle,
      gradient: "from-amber to-rose",
      iconBg: "bg-amber/15",
      iconColor: "text-amber",
      accent: "stat-card-primary",
    },
    {
      label: "Invoices Paid",
      value: `$${invoicePaid.toLocaleString()}`,
      sub: `${invoices.filter((i: any) => i.status === "paid").length} invoices`,
      icon: TrendingUp,
      gradient: "from-cyan to-violet",
      iconBg: "bg-cyan/15",
      iconColor: "text-cyan",
      accent: "stat-card-blue",
    },
    {
      label: d.paid + " Bookings",
      value: `${paidEvents.length}`,
      sub: `of ${events.length} total`,
      icon: Calendar,
      gradient: "from-violet to-rose",
      iconBg: "bg-violet/15",
      iconColor: "text-violet",
      accent: "stat-card-primary",
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">{d.title}</h1>
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Welcome back. Here's your overview.</p>
        </div>
      </div>

      {eventsLoading ? (
        <>
          <StatCardsSkeleton count={4} />
          <CardListSkeleton count={3} />
        </>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {stats.map((s, i) => (
              <Card key={s.label} className={`animate-card-in card-interactive stat-card ${s.accent} overflow-hidden relative`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-[0.04]`} />
                <CardContent className="p-4 md:p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${s.iconBg}`}>
                      <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                  {s.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Profit Analytics — Full Plan Only */}
          {showProfitAnalytics && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <Card className="animate-card-in card-interactive stat-card stat-card-destructive overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-rose to-amber opacity-[0.04]" />
                <CardContent className="p-4 md:p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{d.expenses}</p>
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose/15">
                      <TrendingDown className="h-4 w-4 text-rose" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">${totalExpenses.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="animate-card-in card-interactive stat-card stat-card-emerald overflow-hidden relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${netProfit >= 0 ? "from-emerald to-cyan" : "from-rose to-amber"} opacity-[0.04]`} />
                <CardContent className="p-4 md:p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{d.profit}</p>
                    <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${netProfit >= 0 ? "bg-emerald/15" : "bg-rose/15"}`}>
                      <TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? "text-emerald" : "text-rose"}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold tracking-tight ${netProfit < 0 ? "text-rose" : ""}`}>${netProfit.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="md:col-span-2 animate-card-in card-interactive stat-card stat-card-primary overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet to-cyan opacity-[0.04]" />
                <CardContent className="p-4 md:p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Profit / Booking</p>
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet/15">
                      <DollarSign className="h-4 w-4 text-violet" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">${avgProfitPerBooking.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Upcoming Events */}
          <Card className="animate-card-in overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-violet/10">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  {d.upcoming}
                </CardTitle>
                <Badge className="text-xs font-semibold bg-primary/10 text-primary border-0 hover:bg-primary/15">
                  {upcoming.length} events
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet/10 mb-4">
                    <Calendar className="h-8 w-8 opacity-40" />
                  </div>
                  <p className="font-medium">{d.noEvents}</p>
                  <p className="text-sm mt-1">Create your first booking to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.slice(0, 5).map((ev: any, i: number) => (
                    <div
                      key={ev.id}
                      className="group flex items-center justify-between rounded-xl border p-3 md:p-4 transition-all duration-200 hover:bg-accent/50 hover:shadow-sm hover:border-primary/20"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-violet/10 shrink-0">
                          <span className="text-xs font-bold text-primary leading-none">
                            {format(new Date(ev.event_date), "MMM")}
                          </span>
                          <span className="text-lg font-bold text-primary leading-none">
                            {format(new Date(ev.event_date), "d")}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{(t.app.bookings.types as any)[ev.event_type] ?? ev.event_type}</p>
                          <p className="text-xs text-muted-foreground truncate">{ev.clients?.name ?? "No client"} · {ev.venue ?? "No venue"}</p>
                          {ev.hebrew_date && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{ev.hebrew_date}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right hidden sm:block mr-2">
                          <p className="text-sm font-medium">{format(new Date(ev.event_date), "MMM d, yyyy")}</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 opacity-80 group-hover:opacity-100 border-primary/20 hover:bg-primary/10 hover:text-primary" onClick={() => setViewing(ev)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 opacity-60 group-hover:opacity-100 hover:text-primary" onClick={() => navigate(`/app/bookings?edit=${ev.id}`)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <ViewBookingDialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} event={viewing} />
        </>
      )}
    </div>
  );
}