import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCardsSkeleton } from "@/components/ui/page-skeletons";
import ViewBookingDialog from "@/components/bookings/ViewBookingDialog";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, DollarSign, TrendingDown, AlertCircle, Eye, Pencil,
  ArrowUpRight, Plus, UserPlus, FileText, Wallet, BarChart3, Clock,
} from "lucide-react";

const statusBadge: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  partial: { label: "Partial", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  unpaid: { label: "Unpaid", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800" },
};

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
  const { t } = useLanguage();
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
  events: any[];
  onView: (e: any) => void;
  onEdit: (e: any) => void;
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
      {events.slice(0, 5).map((ev: any) => {
        const ps = ev.payment_status || "unpaid";
        const badge = statusBadge[ps] || statusBadge.unpaid;
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

function RecentInvoices({ invoices, onView }: { invoices: any[]; onView: (e: any) => void }) {
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
      {invoices.slice(0, 5).map((inv: any) => {
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

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*, clients(name)").eq("tenant_id", tenantId!).order("event_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && hasBillAccess,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && hasBillAccess,
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ["all-event-expenses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_expenses").select("amount, event_id");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && showProfitAnalytics,
  });

  const { data: allColleagueCosts = [] } = useQuery({
    queryKey: ["all-colleague-costs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_colleagues").select("price, event_id, payment_responsibility").eq("payment_responsibility", "paid_by_me");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && showProfitAnalytics,
  });

  const { data: allCommissions = [] } = useQuery({
    queryKey: ["all-commissions", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("booking_agents").select("commission_amount, agents!inner(tenant_id)").eq("agents.tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && showProfitAnalytics,
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const upcoming = events.filter((e: any) => new Date(e.event_date) >= now).sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  const paidEvents = events.filter((e: any) => e.payment_status === "paid");
  const unpaidEvents = events.filter((e: any) => e.payment_status !== "paid");
  const thisMonthEvents = events.filter((e: any) => {
    const d = new Date(e.event_date);
    return d >= monthStart && d <= monthEnd;
  });

  const totalRevenue = events.reduce((s: number, e: any) => s + (Number(e.total_price) || 0), 0);
  const revenueReceived = paidEvents.reduce((s: number, e: any) => s + (Number(e.total_price) || 0), 0);
  const outstanding = unpaidEvents.reduce((s: number, e: any) => s + Math.max((Number(e.total_price) || 0) - (Number(e.deposit) || 0), 0), 0);
  const thisMonthRevenue = thisMonthEvents.reduce((s: number, e: any) => s + (Number(e.total_price) || 0), 0);
  const invoicePaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount, 0);
  const recentInvoices = invoices.slice(0, 10);

  const totalManualExpenses = allExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const totalColleagueCosts = allColleagueCosts.reduce((s: number, c: any) => s + (Number(c.price) || 0), 0);
  const totalCommissions = allCommissions.reduce((s: number, c: any) => s + (Number(c.commission_amount) || 0), 0);
  const totalTravelFees = events.filter((e: any) => e.travel_fee_type !== "charge_customer").reduce((s: number, e: any) => s + (Number(e.travel_fee) || 0), 0);
  const totalExpenses = totalManualExpenses + totalColleagueCosts + totalCommissions + totalTravelFees;
  const netProfit = totalRevenue - totalExpenses;
  const avgProfitPerBooking = events.length > 0 ? Math.round(netProfit / events.length) : 0;

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
              <StatCard label="Outstanding" value={`$${outstanding.toLocaleString()}`} sub={`${events.length - paidEvents.length} unpaid bookings`} icon={AlertCircle} accent="amber" />
              <StatCard label="This Month" value={`$${thisMonthRevenue.toLocaleString()}`} sub={`${thisMonthEvents.length} event(s)`} icon={Calendar} accent="cyan" />
              <StatCard label="Total Bookings" value={`${events.length}`} sub={`${paidEvents.length} paid`} icon={BarChart3} accent="violet" />
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
                    onView={setViewing}
                    onEdit={(ev) => navigate(`/app/bookings?edit=${ev.id}`)}
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
                  <RecentInvoices invoices={recentInvoices} onView={() => navigate("/app/invoices")} />
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
                <StatCard label="Invoices Paid" value={`$${invoicePaid.toLocaleString()}`} sub={`${invoices.filter((i: any) => i.status === "paid").length} invoices`} icon={Wallet} accent="cyan" />
              </div>
            </section>
          )}
        </>
      )}

      <ViewBookingDialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} event={viewing} />
    </div>
  );
}
