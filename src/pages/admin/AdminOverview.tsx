import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, CreditCard, TrendingUp, AlertTriangle, MessageSquare, DollarSign,
  Loader2, ArrowRight, UserPlus,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, addDays, isBefore } from "date-fns";
import { adminAction } from "@/lib/admin-functions";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { adminPath } from "@/lib/adminRoute";

const REVENUE_WINDOW_DAYS = 30;

function formatCents(cents: number) {
  return `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Kpi({
  label, value, hint, icon: Icon, tone = "primary",
}: {
  label: string; value: string | number; hint?: string;
  icon: typeof Users; tone?: "primary" | "emerald" | "amber" | "rose" | "blue";
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-destructive/10 text-destructive",
    blue: "bg-blue-500/10 text-blue-600",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
            {hint && <div className="text-[11px] text-muted-foreground/80">{hint}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  const { canManageBilling } = useAdminRole();
  const now = new Date();

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data, error } = await adminAction("list_tenants", {});
      if (error) throw error;
      return data.tenants as any[];
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-users", "", 1],
    queryFn: async () => {
      const { data, error } = await adminAction("list_all_users", { search: "", page: 1, page_size: 5 });
      if (error) throw error;
      return data as { users: any[]; total: number };
    },
  });

  const { data: ticketsData } = useQuery({
    queryKey: ["admin-tickets", "open", 1],
    queryFn: async () => {
      const { data, error } = await adminAction("list_support_tickets", { status: "open", page: 1, page_size: 1 });
      if (error) throw error;
      return data as { tickets: any[]; total: number };
    },
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue", REVENUE_WINDOW_DAYS],
    enabled: canManageBilling,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-stripe-reporting", { body: { days: REVENUE_WINDOW_DAYS } });
      if (error) throw error;
      return data as any;
    },
  });

  const totalTenants = tenants.length;
  const activeSubs = tenants.filter((t) => t.plan !== "trial").length;
  const activeTrials = tenants.filter((t) => t.plan === "trial" && t.trial_ends_at && !isBefore(new Date(t.trial_ends_at), now)).length;
  const expiringSoon = tenants.filter(
    (t) => t.plan === "trial" && t.trial_ends_at && isBefore(new Date(t.trial_ends_at), addDays(now, 7)) && !isBefore(new Date(t.trial_ends_at), now)
  ).length;

  const recentUsers = usersData?.users ?? [];
  const totalUsers = usersData?.total ?? 0;
  const openTickets = ticketsData?.total ?? 0;

  const revenueChart = revenue?.daily_revenue
    ? Object.entries(revenue.daily_revenue as Record<string, number>)
        .map(([date, amount]) => ({ date, revenue: (amount as number) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform health at a glance</p>
      </div>

      {tenantsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Total Users" value={totalUsers} icon={Users} tone="primary" />
            <Kpi label="Workspaces" value={totalTenants} icon={Users} tone="blue" />
            <Kpi label="Paid Subscriptions" value={activeSubs} icon={CreditCard} tone="emerald" />
            <Kpi label="Active Trials" value={activeTrials} icon={TrendingUp} tone="amber" />
            <Kpi label="Expiring in 7 days" value={expiringSoon} icon={AlertTriangle} tone="rose" />
            <Kpi label="Open Tickets" value={openTickets} icon={MessageSquare} tone="primary" />
          </div>

          {canManageBilling && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="MRR" value={formatCents(revenue?.mrr_cents || 0)} icon={DollarSign} tone="emerald" />
                <Kpi label={`Revenue (${REVENUE_WINDOW_DAYS}d)`} value={formatCents(revenue?.total_revenue_cents || 0)} icon={DollarSign} tone="primary" />
                <Kpi label={`New Subs (${REVENUE_WINDOW_DAYS}d)`} value={revenue?.new_subscriptions ?? 0} icon={UserPlus} tone="blue" />
                <Kpi label={`Cancellations (${REVENUE_WINDOW_DAYS}d)`} value={revenue?.canceled ?? 0} icon={AlertTriangle} tone="rose" />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-display text-lg">Revenue · last {REVENUE_WINDOW_DAYS} days</CardTitle>
                  <Link to={adminPath("revenue")} className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                    Full report <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardHeader>
                <CardContent>
                  {revenueChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={revenueChart}>
                        <defs>
                          <linearGradient id="adminOverviewRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                        <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]} />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#adminOverviewRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">No revenue data for this period</div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Recent Signups</CardTitle>
              <Link to={adminPath("users")} className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                All users <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No users yet</div>
              ) : (
                <ul className="divide-y">
                  {recentUsers.map((u: any) => (
                    <li key={u.user_id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email || "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
