import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Car } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface ExpensesProfitSectionProps {
  eventId: string;
  canWrite: boolean;
  totalRevenue: number; // total_price + travel_fee
}

export default function ExpensesProfitSection({ eventId, canWrite, totalRevenue }: ExpensesProfitSectionProps) {
  const qc = useQueryClient();
  const [newExpense, setNewExpense] = useState({ expense_name: "", amount: "", category: "", notes: "" });
  const [showAdd, setShowAdd] = useState(false);

  // Fetch event data for payment status and travel fee
  const { data: eventData } = useQuery({
    queryKey: ["event-detail-for-expenses", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("travel_fee, payment_status, total_price")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch manual expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["event-expenses", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_expenses")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch colleague costs (paid_by_me only)
  const { data: colleagueCosts = [] } = useQuery({
    queryKey: ["event-colleagues-costs", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_colleagues")
        .select("name, price, payment_responsibility")
        .eq("event_id", eventId)
        .eq("payment_responsibility", "paid_by_me");
      if (error) throw error;
      return data;
    },
  });

  // Fetch agent commissions for this booking
  const { data: agentCommissions = [] } = useQuery({
    queryKey: ["event-agent-commissions", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents")
        .select("commission_amount, commission_rate, commission_paid, agents(name)")
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: typeof newExpense) => {
      const { error } = await supabase.from("event_expenses").insert({
        event_id: eventId,
        expense_name: values.expense_name,
        amount: Number(values.amount) || 0,
        category: values.category || null,
        notes: values.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-expenses", eventId] });
      setNewExpense({ expense_name: "", amount: "", category: "", notes: "" });
      setShowAdd(false);
      toast({ title: "Expense added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-expenses", eventId] });
      toast({ title: "Expense removed" });
    },
  });

  const travelFee = Number(eventData?.travel_fee) || 0;
  const isPaid = eventData?.payment_status === "paid";
  const manualTotal = expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const colleagueTotal = colleagueCosts.reduce((s: number, c: any) => s + (Number(c.price) || 0), 0);
  const commissionTotal = agentCommissions.reduce((s: number, c: any) => s + (Number(c.commission_amount) || 0), 0);

  // All expenses always counted
  const totalExpenses = manualTotal + colleagueTotal + commissionTotal + travelFee;
  // Revenue = total expected regardless of payment status
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 font-semibold text-sm">
          <DollarSign className="h-4 w-4 text-primary" />
          Expenses & Profit
        </h4>
        <Badge variant="outline" className={isPaid ? "bg-emerald-500/15 text-emerald-700 border-emerald-200" : "bg-destructive/10 text-destructive border-destructive/20"}>
          {isPaid ? "Paid" : "Unpaid"}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-emerald mb-1" />
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="font-bold text-sm">${totalRevenue.toLocaleString()}</p>
            {!isPaid && (
              <p className="text-[10px] text-amber">Outstanding</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-4 w-4 mx-auto text-destructive mb-1" />
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="font-bold text-sm">${totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className={`h-4 w-4 mx-auto mb-1 ${netProfit >= 0 ? "text-emerald" : "text-destructive"}`} />
            <p className="text-xs text-muted-foreground">Net Profit</p>
            <p className={`font-bold text-sm ${netProfit >= 0 ? "text-emerald" : "text-destructive"}`}>${netProfit.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>


      {/* Agent Commissions (auto) */}
      {agentCommissions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Agent Commissions (auto)</p>
          {agentCommissions.map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1.5">
              <span>{(c.agents as any)?.name || "Agent"} ({c.commission_rate}%)</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">${Number(c.commission_amount || 0).toLocaleString()}</span>
                <Badge variant="outline" className={c.commission_paid ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 text-[10px]" : "bg-amber/15 text-amber border-amber/20 text-[10px]"}>
                  {c.commission_paid ? "Paid" : "Pending"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Colleague Costs (auto) */}
      {colleagueCosts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Musician Costs (auto)</p>
          {colleagueCosts.map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1.5">
              <span>{c.name || "Unnamed"}</span>
              <span className="font-medium">${Number(c.price || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Manual Expenses */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Manual Expenses</p>
          {canWrite && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => setShowAdd(true)}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          )}
        </div>
        {expenses.length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground py-1">No manual expenses.</p>
        )}
        {expenses.map((exp: any) => (
          <div key={exp.id} className="flex items-center justify-between text-xs rounded border px-2 py-1.5">
            <div>
              <span className="font-medium">{exp.expense_name}</span>
              {exp.category && <span className="text-muted-foreground ml-1">({exp.category})</span>}
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">${Number(exp.amount).toLocaleString()}</span>
              {canWrite && (
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteMutation.mutate(exp.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Add form */}
        {showAdd && canWrite && (
          <div className="rounded border p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input className="h-7 text-xs" value={newExpense.expense_name} onChange={(e) => setNewExpense({ ...newExpense, expense_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount ($) *</Label>
                <Input className="h-7 text-xs" type="number" min="0" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Input className="h-7 text-xs" value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input className="h-7 text-xs" value={newExpense.notes} onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="button" size="sm" className="h-6 text-xs" disabled={!newExpense.expense_name || !newExpense.amount} onClick={() => addMutation.mutate(newExpense)}>
                Add Expense
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}