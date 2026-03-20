import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, UserPlus, UserMinus } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminRevenue() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue", days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-stripe-reporting", {
        body: { days },
      });
      if (error) throw error;
      return data;
    },
  });

  const chartData = data?.daily_revenue
    ? Object.entries(data.daily_revenue as Record<string, number>)
        .map(([date, amount]) => ({ date, revenue: (amount as number) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Revenue</h1>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={days === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{formatCents(data?.total_revenue_cents || 0)}</div>
                    <div className="text-xs text-muted-foreground">Total Revenue ({days}d)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{formatCents(data?.mrr_cents || 0)}</div>
                    <div className="text-xs text-muted-foreground">MRR</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{data?.new_subscriptions || 0}</div>
                    <div className="text-xs text-muted-foreground">New Subs ({days}d)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                    <UserMinus className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{data?.canceled || 0}</div>
                    <div className="text-xs text-muted-foreground">Cancellations ({days}d)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#revGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">No revenue data for this period</div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Revenue by Plan (MRR)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200 mb-2">Lite</Badge>
                  <div className="text-xl font-bold">{formatCents(data?.revenue_by_plan?.lite || 0)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 mb-2">Full</Badge>
                  <div className="text-xl font-bold">{formatCents(data?.revenue_by_plan?.full || 0)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="bg-muted text-muted-foreground mb-2">Other</Badge>
                  <div className="text-xl font-bold">{formatCents(data?.revenue_by_plan?.other || 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Extra stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Active Subscriptions: <strong className="text-foreground">{data?.active_subscriptions || 0}</strong></span>
            <span>Refunds: <strong className="text-foreground">{formatCents(data?.refunds_cents || 0)}</strong></span>
          </div>
        </>
      )}
    </div>
  );
}
