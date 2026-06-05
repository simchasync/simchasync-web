import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, TrendingDown, AlertCircle, Eye, Pencil, Share2, Instagram, Facebook, Sparkles, CreditCard, ArrowUpRight, Users } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import ViewBookingDialog from "@/components/bookings/ViewBookingDialog";
import { StatCardsSkeleton } from "@/components/ui/page-skeletons";

const paymentConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-emerald/10 text-emerald border-emerald/20" },
  deposit: { label: "Deposit", className: "bg-amber/10 text-amber border-amber/20" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
};

export default function Dashboard() {
  const { t } = useLanguage();
  const d = t.app.dashboard;
  const { tenantId } = useTenantId();
  const { isSocialOnly } = useUserRole();
  const { canAccess } = useSubscription();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<any>(null);

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
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">Social Media Dashboard</h1>
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 animate-card-in">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet/10 mb-5">
                <Share2 className="h-7 w-7 text-primary/60" />
              </div>
              <h2 className="text-xl font-display font-semibold mb-2">Social Media Overview</h2>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                Your social media analytics and performance metrics will appear here.
                This dashboard is coming soon in Phase 3!
              </p>
            </CardContent>
          </Card>
          <div className="space-y-4">
            {[
              { icon: Instagram, label: "Instagram", color: "text-rose" },
              { icon: Facebook, label: "Facebook", color: "text-cyan" },
              { icon: Users, label: "Audience", color: "text-violet" },
            ].map((item) => (
              <Card key={item.label} className="animate-card-in card-interactive">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-muted shrink-0">
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">Coming soon</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const upcoming = events.filter((e: any) => new Date(e.event_date) >= now);
  const paidEvents = events.filter((e: any) => e.payment_status === "paid");
  const unpaidEvents = events.filter((e: any) => e.payment_status !== "paid");
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

  const statColors: Record<string, { hue: string; iconClass: string; bgClass: string }> = {
    emerald: { hue: "var(--emerald)", iconClass: "text-emerald", bgClass: "bg-emerald/10" },
    amber: { hue: "var(--amber)", iconClass: "text-amber", bgClass: "bg-amber/10" },
    cyan: { hue: "var(--cyan)", iconClass: "text-cyan", bgClass: "bg-cyan/10" },
    violet: { hue: "var(--violet)", iconClass: "text-violet", bgClass: "bg-violet/10" },
    rose: { hue: "var(--rose)", iconClass: "text-rose", bgClass: "bg-rose/10" },
  };

  const stats = [
    {
      label: "Total Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      sub: `$${revenueReceived.toLocaleString()} received`,
      icon: DollarSign,
      color: "emerald",
    },
    {
      label: d.outstanding,
      value: `$${outstanding.toLocaleString()}`,
      sub: `${unpaidInvoices.length} unpaid invoices`,
      icon: AlertCircle,
      color: "amber",
    },
    {
      label: "Invoices Paid",
      value: `$${invoicePaid.toLocaleString()}`,
      sub: `${invoices.filter((i: any) => i.status === "paid").length} invoices`,
      icon: CreditCard,
      color: "cyan",
    },
    {
      label: d.paid + " Bookings",
      value: `${paidEvents.length}`,
      sub: `of ${events.length} total`,
      icon: Calendar,
      color: "violet",
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">{d.title}</h1>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Welcome back. Here&apos;s your overview.</p>
        </div>
      </div>

      {eventsLoading ? (
        <StatCardsSkeleton count={4} />
      ) : (
        <>
          {/* Stat Cards */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-primary to-primary/40" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Overview</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {stats.map((s, i) => {
                const c = statColors[s.color];
                return (
                  <Card
                    key={s.label}
                    className="animate-card-in card-interactive stat-card overflow-hidden relative border-t-[3px]"
                    style={{
                      animationDelay: `${i * 60}ms`,
                      borderTopColor: `hsl(${c.hue} / 0.4)`,
                    }}
                  >
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${c.bgClass}`}>
                          <s.icon className={`h-4 w-4 ${c.iconClass}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                      {s.sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{s.sub}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Profit Analytics — Full Plan Only */}
          {showProfitAnalytics && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald to-cyan" />
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Profit Analytics</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <Card className="animate-card-in card-interactive overflow-hidden relative"
                style={{ borderTop: "3px solid hsla(var(--rose) / 0.4)" }}
              >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{d.expenses}</p>
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose/10">
                        <TrendingDown className="h-4 w-4 text-rose" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">${totalExpenses.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="animate-card-in card-interactive overflow-hidden relative"
                  style={{ borderTop: `3px solid ${netProfit >= 0 ? "hsla(var(--emerald) / 0.4)" : "hsla(var(--rose) / 0.4)"}` }}
                >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{d.profit}</p>
                      <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${netProfit >= 0 ? "bg-emerald/10" : "bg-rose/10"}`}>
                        <ArrowUpRight className={`h-4 w-4 ${netProfit >= 0 ? "text-emerald" : "text-rose"}`} />
                      </div>
                    </div>
                    <p className={`text-2xl font-bold tracking-tight ${netProfit < 0 ? "text-rose" : ""}`}>
                      {netProfit >= 0 ? "+" : ""}${netProfit.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card className="md:col-span-2 animate-card-in card-interactive overflow-hidden relative"
                  style={{ borderTop: "3px solid hsla(var(--violet) / 0.4)" }}
                >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Profit / Booking</p>
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet/10">
                        <DollarSign className="h-4 w-4 text-violet" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">${avgProfitPerBooking.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}

          {/* Upcoming Events */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-primary to-violet" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{d.upcoming}</h2>
            </div>
            <Card className="animate-card-in overflow-hidden">
              {upcoming.length === 0 ? (
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet/10 mb-4">
                      <Calendar className="h-8 w-8 text-primary/40" />
                    </div>
                    <p className="font-medium text-foreground">{d.noEvents}</p>
                    <p className="text-sm mt-1">Create your first booking to get started</p>
                    <Button className="mt-5 gap-1.5" size="sm" onClick={() => navigate("/app/bookings")}>
                      <Calendar className="h-4 w-4" />
                      New Booking
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <>
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">{d.upcoming}</CardTitle>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {upcoming.length} upcoming
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="divide-y divide-border/50">
                      {upcoming.slice(0, 5).map((ev: any, i: number) => {
                        const paymentStatus = ev.payment_status || "pending";
                        const cfg = paymentConfig[paymentStatus] || paymentConfig.pending;
                        return (
                          <div
                            key={ev.id}
                            className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/30 -mx-1 px-1 rounded-lg"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            {/* Date badge */}
                            <div className="hidden sm:flex flex-col items-center justify-center w-12 h-[52px] rounded-xl bg-gradient-to-b from-primary/10 to-primary/5 shrink-0 border border-primary/10">
                              <span className="text-[10px] font-bold text-primary uppercase leading-tight">
                                {format(new Date(ev.event_date), "MMM")}
                              </span>
                              <span className="text-lg font-bold text-foreground leading-tight -mt-0.5">
                                {format(new Date(ev.event_date), "d")}
                              </span>
                            </div>

                            {/* Event info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">
                                  {(t.app.bookings.types as any)[ev.event_type] ?? ev.event_type}
                                </p>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${cfg.className}`}>
                                  {cfg.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">{ev.clients?.name ?? "No client"}</span>
                                {ev.venue && (
                                  <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="text-xs text-muted-foreground truncate">{ev.venue}</span>
                                  </>
                                )}
                              </div>
                              {ev.hebrew_date && (
                                <p className="text-[11px] text-muted-foreground/50 mt-0.5">{ev.hebrew_date}</p>
                              )}
                            </div>

                            {/* Desktop date + actions */}
                            <div className="hidden md:flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground mr-1">
                                {format(new Date(ev.event_date), "EEE, MMM d")}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setViewing(ev)}
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => navigate(`/app/bookings?edit=${ev.id}`)}
                                title="Edit booking"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Mobile action */}
                            <div className="flex md:hidden shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => setViewing(ev)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {upcoming.length > 5 && (
                      <>
                        <Separator className="my-3" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => navigate("/app/bookings")}
                        >
                          View all {upcoming.length} events
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </>
              )}
            </Card>
          </section>

          <ViewBookingDialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} event={viewing} />
        </>
      )}
    </div>
  );
}