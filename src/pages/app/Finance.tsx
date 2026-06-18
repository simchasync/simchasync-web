import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, Plus, Pencil, Trash2,
  Printer, Calendar as CalendarIcon
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, parseISO, isWithinInterval } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { computeBalanceDue, getEffectiveTotal } from "@/lib/bookingFinancials";
import { buildPnLLines, type ReportTotals } from "@/lib/financialReport";
import FinancialReportPrint, {
  type ReportExpenseRow, type ReportIncomeRow, type ReportAgentRow,
} from "@/components/finance/FinancialReportPrint";
import { StatCardsSkeleton } from "@/components/ui/page-skeletons";
import { StatCard } from "@/components/ui/stat-card";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "fuel", "marketing", "salaries", "equipment", "rent", "insurance",
  "meals", "travel", "supplies", "software", "other"
];

type DatePreset = "this_month" | "last_month" | "this_year" | "last_6_months" | "custom";

function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string) {
  const now = new Date();
  switch (preset) {
    case "this_month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case "this_year": return { from: startOfYear(now), to: endOfYear(now) };
    case "last_6_months": return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
    case "custom": return {
      from: customFrom ? parseISO(customFrom) : startOfMonth(now),
      to: customTo ? parseISO(customTo) : endOfMonth(now),
    };
  }
}

export default function Finance() {
  const { tenantId, userTenants } = useTenantId();
  const { canAccess, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [expenseForm, setExpenseForm] = useState({
    title: "", amount: "", category: "other", expense_date: format(new Date(), "yyyy-MM-dd"), notes: ""
  });

  const dateRange = getDateRange(datePreset, customFrom, customTo);

  // Fetch confirmed bookings (income)
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["finance-events", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, event_date, event_type, total_price, travel_fee, travel_fee_type, payment_status, clients(name)")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch workspace expenses
  const { data: workspaceExpenses = [], isLoading: workspaceExpensesLoading } = useQuery({
    queryKey: ["workspace-expenses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_expenses")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch per-event expenses
  const { data: eventExpenses = [], isLoading: eventExpensesLoading } = useQuery({
    queryKey: ["finance-event-expenses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_expenses")
        .select("*, events!inner(tenant_id, event_date)")
        .eq("events.tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch commissions with agent and booking details
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ["finance-commissions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents")
        .select("commission_amount, commission_rate, commission_paid, agent_id, agents!inner(name, tenant_id), events!inner(tenant_id, event_date, event_type, clients(name))")
        .eq("agents.tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch colleague costs (paid_by_me)
  const { data: colleagueCosts = [], isLoading: colleagueCostsLoading } = useQuery({
    queryKey: ["finance-colleague-costs", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_colleagues")
        .select("price, payment_responsibility, events!inner(tenant_id, event_date)")
        .eq("events.tenant_id", tenantId!)
        .eq("payment_responsibility", "paid_by_me");
      if (error) throw error;
      return data;
    },
  });

  // Filter data by date range
  const inRange = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    } catch { return false; }
  };

  const filteredEvents = events.filter((e: any) => inRange(e.event_date));
  const filteredWorkspaceExpenses = workspaceExpenses.filter((e: any) => inRange(e.expense_date));
  const filteredEventExpenses = eventExpenses.filter((e: any) => inRange(e.events?.event_date));
  const filteredCommissions = commissions.filter((c: any) => inRange(c.events?.event_date));
  const filteredColleagueCosts = colleagueCosts.filter((c: any) => inRange(c.events?.event_date));

  // Agent-level commission breakdown
  const agentCommissionBreakdown = (() => {
    const map: Record<string, { name: string; total: number; paid: number; pending: number; bookings: any[] }> = {};
    filteredCommissions.forEach((c: any) => {
      const agentName = c.agents?.name || "Unknown";
      const agentId = c.agent_id;
      if (!map[agentId]) map[agentId] = { name: agentName, total: 0, paid: 0, pending: 0, bookings: [] };
      const amt = Number(c.commission_amount) || 0;
      map[agentId].total += amt;
      if (c.commission_paid) map[agentId].paid += amt;
      else map[agentId].pending += amt;
      map[agentId].bookings.push(c);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // Revenue = total expected money from ALL bookings (regardless of payment status)
  // Travel fees charged to the customer count as additional revenue
  const totalRevenue = filteredEvents.reduce((s: number, e: any) => {
    const base = Number(e.total_price) || 0;
    const tf = e.travel_fee_type === "charge_customer" ? (Number(e.travel_fee) || 0) : 0;
    return s + base + tf;
  }, 0);

  // Only owner-expense travel fees count as a cost
  const totalTravelFees = filteredEvents.reduce((s: number, e: any) =>
    s + (e.travel_fee_type !== "charge_customer" ? (Number(e.travel_fee) || 0) : 0), 0);

  const totalWorkspaceExpenses = filteredWorkspaceExpenses.reduce((s: number, e: any) =>
    s + (Number(e.amount) || 0), 0);

  const totalEventExpenses = filteredEventExpenses.reduce((s: number, e: any) =>
    s + (Number(e.amount) || 0), 0);

  const totalColleagueCosts = filteredColleagueCosts.reduce((s: number, c: any) =>
    s + (Number(c.price) || 0), 0);

  const totalCommissions = filteredCommissions.reduce((s: number, c: any) =>
    s + (Number(c.commission_amount) || 0), 0);

  const totalExpenses = totalWorkspaceExpenses + totalEventExpenses + totalColleagueCosts + totalTravelFees + totalCommissions;
  const netProfit = totalRevenue - totalExpenses;

  // Revenue received (paid bookings only)
  const paidEvents = filteredEvents.filter((e: any) => e.payment_status === "paid");
  const revenueReceived = paidEvents.reduce((s: number, e: any) =>
    s + getEffectiveTotal(Number(e.total_price) || 0, Number(e.travel_fee) || 0, e.travel_fee_type), 0);

  // Outstanding = unpaid booking totals (incl. travel fees billed to the customer) minus deposits
  const unpaidEvents = filteredEvents.filter((e: any) => e.payment_status !== "paid");
  const totalOutstanding = unpaidEvents.reduce((s: number, e: any) =>
    s + computeBalanceDue(Number(e.total_price) || 0, Number(e.deposit) || 0, Number(e.travel_fee) || 0, e.travel_fee_type), 0);

  // Monthly breakdown for chart
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; expenses: number; commissions: number; profit: number }> = {};
    const addMonth = (dateStr: string) => {
      const key = dateStr.substring(0, 7);
      if (!months[key]) months[key] = { month: key, revenue: 0, expenses: 0, commissions: 0, profit: 0 };
      return months[key];
    };

    filteredEvents.forEach((e: any) => {
      const m = addMonth(e.event_date);
      const tf = Number(e.travel_fee) || 0;
      m.revenue += (Number(e.total_price) || 0) + (e.travel_fee_type === "charge_customer" ? tf : 0);
      if (e.travel_fee_type !== "charge_customer") m.expenses += tf;
    });
    filteredWorkspaceExpenses.forEach((e: any) => { addMonth(e.expense_date).expenses += Number(e.amount) || 0; });
    filteredEventExpenses.forEach((e: any) => { if (e.events?.event_date) addMonth(e.events.event_date).expenses += Number(e.amount) || 0; });
    filteredColleagueCosts.forEach((c: any) => { if (c.events?.event_date) addMonth(c.events.event_date).expenses += Number(c.price) || 0; });
    filteredCommissions.forEach((c: any) => { if (c.events?.event_date) addMonth(c.events.event_date).commissions += Number(c.commission_amount) || 0; });

    Object.values(months).forEach(m => { m.profit = m.revenue - m.expenses - m.commissions; });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredEvents, filteredWorkspaceExpenses, filteredEventExpenses, filteredCommissions, filteredColleagueCosts]);

  // Expense CRUD
  const saveMutation = useMutation({
    mutationFn: async (form: typeof expenseForm) => {
      const payload = {
        tenant_id: tenantId!,
        title: form.title,
        amount: Number(form.amount) || 0,
        category: form.category,
        expense_date: form.expense_date,
        notes: form.notes || null,
      };
      if (editingExpense) {
        const { error } = await supabase.from("workspace_expenses").update(payload).eq("id", editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workspace_expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-expenses", tenantId] });
      closeExpenseDialog();
      toast({ title: editingExpense ? "Expense updated" : "Expense added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-expenses", tenantId] });
      toast({ title: "Expense deleted" });
    },
  });

  const openNewExpense = () => {
    setEditingExpense(null);
    setExpenseForm({ title: "", amount: "", category: "other", expense_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
    setExpenseDialog(true);
  };

  const openEditExpense = (exp: any) => {
    setEditingExpense(exp);
    setExpenseForm({
      title: exp.title, amount: String(exp.amount), category: exp.category,
      expense_date: exp.expense_date, notes: exp.notes || ""
    });
    setExpenseDialog(true);
  };

  const closeExpenseDialog = () => { setExpenseDialog(false); setEditingExpense(null); };

  const handlePrint = () => {
    window.print();
  };

  const isLoading = eventsLoading || workspaceExpensesLoading || eventExpensesLoading || commissionsLoading || colleagueCostsLoading;

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateLabel = `${format(dateRange.from, "MMM d, yyyy")} — ${format(dateRange.to, "MMM d, yyyy")}`;

  // Workspace branding for the printable report header.
  const workspaceName = userTenants.find((t: any) => t.tenant_id === tenantId)?.tenant_name || "Workspace";
  const { data: branding } = useQuery({
    queryKey: ["finance-branding", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_landing_pages" as any)
        .select("logo_url")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as { logo_url?: string } | null;
    },
  });

  // Report model — single source shared by the printable template.
  const reportTotals: ReportTotals = {
    totalRevenue, totalWorkspaceExpenses, totalEventExpenses,
    totalTravelFees, totalColleagueCosts, totalCommissions,
  };
  const pnlLines = buildPnLLines(reportTotals);
  const reportExpenses: ReportExpenseRow[] = filteredWorkspaceExpenses.map((e: any) => ({
    id: e.id, title: e.title, category: e.category,
    date: format(parseISO(e.expense_date), "MMM d, yyyy"),
    amount: Number(e.amount) || 0, notes: e.notes,
  }));
  const reportIncome: ReportIncomeRow[] = filteredEvents.map((e: any) => ({
    id: e.id, client: (e.clients as any)?.name || "—", type: e.event_type,
    date: format(parseISO(e.event_date), "MMM d, yyyy"),
    status: e.payment_status, amount: Number(e.total_price) || 0,
  }));
  const reportAgents: ReportAgentRow[] = agentCommissionBreakdown.map((a) => ({
    name: a.name, bookings: a.bookings.length, total: a.total, paid: a.paid, pending: a.pending,
  }));
  const generatedAt = format(new Date(), "MMM d, yyyy 'at' h:mm a");

  // Financial reports are a Pro/Premium feature
  if (!subLoading && !canAccess("expenses_profit")) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <Card className="animate-card-in">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Crown className="h-7 w-7 text-primary" />
            </div>
            <p className="font-display text-lg font-semibold">Financial Reports is a Pro feature</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Upgrade to unlock P&L reports, expense tracking, commissions, and profitability analytics.
            </p>
            <Button
              className="mt-5 bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
              onClick={() => navigate("/app/upgrade")}
            >
              <Crown className="mr-2 h-4 w-4" /> Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">Financial Reports</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="w-full sm:w-auto">
          <Printer className="h-4 w-4 mr-2" /> Print / PDF
        </Button>
      </div>

      {/* Date Filter */}
      <Card className="rounded-xl">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5"><CalendarIcon className="h-3 w-3 text-muted-foreground" /> Period</Label>
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {datePreset === "custom" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" className="h-9 w-[150px]" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" className="h-9 w-[150px]" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* On-screen report area (the printable PDF is rendered by
          <FinancialReportPrint/> below, portaled to <body>). */}
      <div ref={printRef} className="space-y-6">
        {/* Summary Cards */}
        {isLoading ? (
          <StatCardsSkeleton count={5} />
        ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 md:gap-4">
          <StatCard label="Total Revenue" value={fmt(totalRevenue)} sub={`${filteredEvents.length} bookings · ${fmt(revenueReceived)} received`} icon={TrendingUp} accent="emerald" />
          <StatCard label="Expenses" value={fmt(totalExpenses)} sub={`incl. ${fmt(totalTravelFees)} travel`} icon={TrendingDown} accent="rose" />
          <StatCard label="Commissions" value={fmt(totalCommissions)} sub={`${filteredCommissions.length} agents`} icon={DollarSign} accent="amber" />
          <StatCard label="Outstanding" value={fmt(totalOutstanding)} sub={`${unpaidEvents.length} unpaid`} icon={CalendarIcon} accent="violet" />
          <StatCard label="Net Profit" value={fmt(netProfit)} sub={totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}% margin` : "—"} icon={BarChart3} accent={netProfit >= 0 ? "emerald" : "rose"} />
        </div>
        )}

        {/* Chart */}
        {monthlyData.length > 0 && (
          <Card className="print:break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="commissions" name="Commissions" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tabs: P&L Details / Expenses / Income */}
        <Tabs defaultValue="pnl" className="print:hidden">
          <TabsList>
            <TabsTrigger value="pnl">P&L Summary</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>

          {/* P&L Summary */}
          <TabsContent value="pnl">
            <Card>
              <CardContent className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-emerald-600">Booking Revenue</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">{fmt(totalRevenue)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium text-destructive">General Expenses</TableCell>
                      <TableCell className="text-right font-medium text-destructive">-{fmt(totalWorkspaceExpenses)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-destructive">Per-Event Expenses</TableCell>
                      <TableCell className="text-right font-medium text-destructive">-{fmt(totalEventExpenses)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-destructive">Travel Fees</TableCell>
                      <TableCell className="text-right font-medium text-destructive">-{fmt(totalTravelFees)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-destructive">Musician Costs</TableCell>
                      <TableCell className="text-right font-medium text-destructive">-{fmt(totalColleagueCosts)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-orange-600">Agent Commissions</TableCell>
                      <TableCell className="text-right font-medium text-orange-600">-{fmt(totalCommissions)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 bg-muted/50">
                      <TableCell className="font-bold text-lg">Net Profit</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {fmt(netProfit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Breakdown */}
          <TabsContent value="commissions">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Agent Commission Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-center">Bookings</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentCommissionBreakdown.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No agent commissions for this period.</TableCell></TableRow>
                    )}
                    {agentCommissionBreakdown.map((agent) => (
                      <TableRow key={agent.name}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell className="text-center">{agent.bookings.length}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(agent.total)}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{fmt(agent.paid)}</TableCell>
                        <TableCell className="text-right font-medium text-amber-600">{fmt(agent.pending)}</TableCell>
                      </TableRow>
                    ))}
                    {agentCommissionBreakdown.length > 0 && (
                      <TableRow className="border-t-2 bg-muted/50">
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-center font-bold">{filteredCommissions.length}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(totalCommissions)}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          {fmt(agentCommissionBreakdown.reduce((s, a) => s + a.paid, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-600">
                          {fmt(agentCommissionBreakdown.reduce((s, a) => s + a.pending, 0))}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <div className="space-y-6">
              {/* Expense Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">All Expenses Overview</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>General / Business Expenses</TableCell>
                        <TableCell className="text-right font-medium">{fmt(totalWorkspaceExpenses)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Per-Event Expenses</TableCell>
                        <TableCell className="text-right font-medium">{fmt(totalEventExpenses)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Travel Fees</TableCell>
                        <TableCell className="text-right font-medium">{fmt(totalTravelFees)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Musician Costs</TableCell>
                        <TableCell className="text-right font-medium">{fmt(totalColleagueCosts)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Agent Commissions</TableCell>
                        <TableCell className="text-right font-medium">{fmt(totalCommissions)}</TableCell>
                      </TableRow>
                      <TableRow className="border-t-2 bg-muted/50">
                        <TableCell className="font-bold">Total Expenses</TableCell>
                        <TableCell className="text-right font-bold text-destructive">{fmt(totalExpenses)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* General Expenses CRUD */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">General / Business Expenses</CardTitle>
                  <Button size="sm" onClick={openNewExpense}>
                    <Plus className="h-4 w-4 mr-1" /> Add Expense
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWorkspaceExpenses.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No general expenses for this period. Add rent, bills, subscriptions and more.</TableCell></TableRow>
                      )}
                      {filteredWorkspaceExpenses.map((exp: any) => (
                        <TableRow key={exp.id}>
                          <TableCell className="font-medium">
                            {exp.title}
                            {exp.notes && <p className="text-xs text-muted-foreground">{exp.notes}</p>}
                          </TableCell>
                          <TableCell>
                            <span className="capitalize text-xs bg-muted px-2 py-0.5 rounded">{exp.category}</span>
                          </TableCell>
                          <TableCell className="text-sm">{format(parseISO(exp.expense_date), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(Number(exp.amount))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditExpense(exp)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(exp.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredWorkspaceExpenses.length > 0 && (
                        <TableRow className="border-t-2 bg-muted/50">
                          <TableCell colSpan={3} className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-bold">{fmt(totalWorkspaceExpenses)}</TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Income from Bookings */}
          <TabsContent value="income">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Booking Income</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No bookings for this period.</TableCell></TableRow>
                    )}
                    {filteredEvents.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{(e.clients as any)?.name || "—"}</TableCell>
                        <TableCell className="capitalize text-sm">{e.event_type}</TableCell>
                        <TableCell className="text-sm">{format(parseISO(e.event_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${e.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : e.payment_status === "partial" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                            {e.payment_status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(e.total_price) || 0)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredEvents.length > 0 && (
                      <TableRow className="border-t-2 bg-muted/50">
                        <TableCell colSpan={4} className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold">{fmt(totalRevenue)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>

      {/* Professional printable PDF report (portaled to <body>, print-only) */}
      <FinancialReportPrint
        meta={{
          workspaceName,
          logoUrl: branding?.logo_url || undefined,
          periodLabel: dateLabel,
          generatedAt,
        }}
        totals={reportTotals}
        pnlLines={pnlLines}
        expenses={reportExpenses}
        income={reportIncome}
        agents={reportAgents}
      />

      {/* Expense Add/Edit Dialog */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={expenseForm.title} onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount ($) *</Label>
                <Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={expenseForm.category} onValueChange={v => setExpenseForm({ ...expenseForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}><span className="capitalize">{c}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeExpenseDialog}>Cancel</Button>
            <Button
              disabled={!expenseForm.title || !expenseForm.amount}
              onClick={() => saveMutation.mutate(expenseForm)}
            >
              {editingExpense ? "Update" : "Add"} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
