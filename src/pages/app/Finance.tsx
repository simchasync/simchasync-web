import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { useLanguage } from "@/contexts/LanguageContext";
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
  FileDown, Printer, Calendar as CalendarIcon
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, parseISO, isWithinInterval } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

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
  const { tenantId } = useTenantId();
  const { t } = useLanguage();
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
  const { data: events = [] } = useQuery({
    queryKey: ["finance-events", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, event_date, event_type, total_price, travel_fee, payment_status, clients(name)")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch workspace expenses
  const { data: workspaceExpenses = [] } = useQuery({
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
  const { data: eventExpenses = [] } = useQuery({
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
  const { data: commissions = [] } = useQuery({
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
  const { data: colleagueCosts = [] } = useQuery({
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
  const totalRevenue = filteredEvents.reduce((s: number, e: any) =>
    s + (Number(e.total_price) || 0), 0);

  // Expenses: travel fees, manual, colleague costs, commissions — always counted
  const totalTravelFees = filteredEvents.reduce((s: number, e: any) =>
    s + (Number(e.travel_fee) || 0), 0);

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
    s + (Number(e.total_price) || 0), 0);

  // Outstanding = unpaid booking totals minus deposits
  const unpaidEvents = filteredEvents.filter((e: any) => e.payment_status !== "paid");
  const totalOutstanding = unpaidEvents.reduce((s: number, e: any) =>
    s + Math.max((Number(e.total_price) || 0) - (Number(e.deposit) || 0), 0), 0);

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
      m.revenue += Number(e.total_price) || 0;
      m.expenses += Number(e.travel_fee) || 0;
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

  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateLabel = `${format(dateRange.from, "MMM d, yyyy")} — ${format(dateRange.to, "MMM d, yyyy")}`;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financial Reports</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Period</Label>
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

      {/* Printable Report Area */}
      <div ref={printRef} className="print-report space-y-6">
        {/* Print-only header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Profit & Loss Report</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald" />
                <span className="text-xs text-muted-foreground font-medium">Total Revenue</span>
              </div>
              <p className="text-xl font-bold text-emerald">{fmt(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{filteredEvents.length} bookings · {fmt(revenueReceived)} received</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground font-medium">Expenses</span>
              </div>
              <p className="text-xl font-bold text-destructive">{fmt(totalExpenses)}</p>
              <p className="text-xs text-muted-foreground">
                incl. {fmt(totalTravelFees)} travel
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-amber" />
                <span className="text-xs text-muted-foreground font-medium">Commissions</span>
              </div>
              <p className="text-xl font-bold text-amber">{fmt(totalCommissions)}</p>
              <p className="text-xs text-muted-foreground">{filteredCommissions.length} agents</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarIcon className="h-4 w-4 text-rose" />
                <span className="text-xs text-muted-foreground font-medium">Outstanding</span>
              </div>
              <p className="text-xl font-bold text-rose">{fmt(totalOutstanding)}</p>
              <p className="text-xs text-muted-foreground">{unpaidEvents.length} unpaid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className={`h-4 w-4 ${netProfit >= 0 ? "text-emerald-500" : "text-destructive"}`} />
                <span className="text-xs text-muted-foreground font-medium">Net Profit</span>
              </div>
              <p className={`text-xl font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {fmt(netProfit)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}% margin` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

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

        {/* Print-only P&L table */}
        <div className="hidden print:block">
          <h2 className="text-lg font-bold mb-2">Profit & Loss Details</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-2">Category</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="py-1.5">Booking Revenue</td><td className="text-right">{fmt(totalRevenue)}</td></tr>
              <tr><td className="py-1.5">General Expenses</td><td className="text-right">-{fmt(totalWorkspaceExpenses)}</td></tr>
              <tr><td className="py-1.5">Per-Event Expenses</td><td className="text-right">-{fmt(totalEventExpenses)}</td></tr>
              <tr><td className="py-1.5">Travel Fees</td><td className="text-right">-{fmt(totalTravelFees)}</td></tr>
              <tr><td className="py-1.5">Musician Costs</td><td className="text-right">-{fmt(totalColleagueCosts)}</td></tr>
              <tr><td className="py-1.5">Agent Commissions</td><td className="text-right">-{fmt(totalCommissions)}</td></tr>
              <tr className="border-t-2 font-bold text-lg">
                <td className="py-2">Net Profit</td>
                <td className="text-right">{fmt(netProfit)}</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-lg font-bold mt-6 mb-2">Expense Details</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Title</th>
                <th className="text-left py-1">Category</th>
                <th className="text-left py-1">Date</th>
                <th className="text-right py-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkspaceExpenses.map((exp: any) => (
                <tr key={exp.id} className="border-b border-muted">
                  <td className="py-1">{exp.title}</td>
                  <td className="py-1 capitalize">{exp.category}</td>
                  <td className="py-1">{exp.expense_date}</td>
                  <td className="text-right py-1">{fmt(Number(exp.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-lg font-bold mt-6 mb-2">Booking Income</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Client</th>
                <th className="text-left py-1">Type</th>
                <th className="text-left py-1">Date</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e: any) => (
                <tr key={e.id} className="border-b border-muted">
                  <td className="py-1">{(e.clients as any)?.name || "—"}</td>
                  <td className="py-1 capitalize">{e.event_type}</td>
                  <td className="py-1">{e.event_date}</td>
                  <td className="text-right py-1">{fmt(Number(e.total_price) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
