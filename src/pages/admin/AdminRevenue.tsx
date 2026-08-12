import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue", range ? `range-${range.start}-${range.end}` : `days-${days}`],
    queryFn: async () => {
      const body = range ? { start: range.start, end: range.end } : { days };
      const { data, error } = await supabase.functions.invoke("admin-stripe-reporting", { body });
      if (error) throw error;
      return data;
    },
  });

  const periodLabel = range ? `${range.start} → ${range.end}` : `${days}d`;

  const chartData = data?.daily_revenue
    ? Object.entries(data.daily_revenue as Record<string, number>)
        .map(([date, amount]) => ({ date, revenue: (amount as number) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Revenue</h1>
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={!range && days === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => { setRange(null); setDays(opt.value); }}
            >
              {opt.label}
            </Button>
          ))}
          <div className="flex items-center gap-1">
            <Input type="date" className="h-8 w-36 text-xs" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" className="h-8 w-36 text-xs" value={endInput} onChange={(e) => setEndInput(e.target.value)} />
            <Button size="sm" variant={range ? "default" : "outline"} disabled={!startInput || !endInput} onClick={() => setRange({ start: startInput, end: endInput })}>Apply</Button>
            {range && <Button size="sm" variant="ghost" onClick={() => { setRange(null); setStartInput(""); setEndInput(""); }}>Clear</Button>}
          </div>
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
                    <div className="text-xs text-muted-foreground">Total Revenue ({periodLabel})</div>
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
                    <div className="text-xs text-muted-foreground">New Subs ({periodLabel})</div>
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
                    <div className="text-xs text-muted-foreground">Cancellations ({periodLabel})</div>
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

          {/* Revenue by Plan (MRR) */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Revenue by Plan (MRR)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200 mb-2">Lite</Badge>
                  <div className="text-xl font-bold">{formatCents(data?.revenue_by_plan?.lite || 0)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 mb-2">Pro</Badge>
                  <div className="text-xl font-bold">{formatCents(data?.revenue_by_plan?.full || 0)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="bg-violet-500/10 text-violet-700 border-violet-200 mb-2">Premium</Badge>
                  <div className="text-xl font-bold">{formatCents(data?.revenue_by_plan?.premium || 0)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="bg-muted text-muted-foreground mb-2">Other</Badge>
                  <div className="text-xl font-bold">{formatCents(data?.revenue_by_plan?.other || 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Earned by Plan — actual revenue collected in the period, per tier */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Earned by Plan ({periodLabel})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Revenue Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {([["Lite", "lite"], ["Pro", "full"], ["Premium", "premium"], ["Other", "other"]] as const).map(([label, key]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="text-right">{formatCents(data?.earned_by_plan?.[key] || 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{formatCents(data?.total_revenue_cents || 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
