import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, UserCheck, DollarSign, TrendingUp, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

export default function Agents() {
  const { t } = useLanguage();
  const { tenantId } = useTenantId();
  const { isOwner } = useUserRole();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", commission_rate: "10", notes: "" });
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Fetch agents
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch commission data with booking details
  const { data: commissions = [] } = useQuery({
    queryKey: ["booking-agents-all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents")
        .select("*, agents!inner(name, tenant_id), events!inner(event_type, event_date, total_price, tenant_id, clients(name))")
        .eq("agents.tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        commission_rate: Number(values.commission_rate) || 10,
        notes: values.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("agents").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agents").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", tenantId] });
      toast({ title: editing ? "Agent updated" : "Agent added" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", tenantId] });
      toast({ title: "Agent deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("booking_agents").update({ commission_paid: paid } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-agents-all", tenantId] });
      toast({ title: "Commission status updated" });
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", commission_rate: "10", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (agent: any) => {
    setEditing(agent);
    setForm({
      name: agent.name,
      email: agent.email || "",
      phone: agent.phone || "",
      commission_rate: String(agent.commission_rate),
      notes: agent.notes || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  // Commission report calculations
  const agentStats = agents.map((agent) => {
    const agentCommissions = commissions.filter((c: any) => c.agent_id === agent.id);
    const totalCommission = agentCommissions.reduce((s: number, c: any) => s + (Number(c.commission_amount) || 0), 0);
    const paidCommission = agentCommissions.filter((c: any) => c.commission_paid).reduce((s: number, c: any) => s + (Number(c.commission_amount) || 0), 0);
    const pendingCommission = totalCommission - paidCommission;
    const bookingCount = agentCommissions.length;
    return { ...agent, totalCommission, paidCommission, pendingCommission, bookingCount, bookings: agentCommissions };
  });

  const totalCommissions = agentStats.reduce((s, a) => s + a.totalCommission, 0);
  const totalPaid = agentStats.reduce((s, a) => s + a.paidCommission, 0);
  const totalPending = agentStats.reduce((s, a) => s + a.pendingCommission, 0);
  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Agents & Commissions</h1>
        {isOwner && (
          <Button onClick={openNew} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
            <Plus className="mr-2 h-4 w-4" /> Add Agent
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card className="animate-card-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Agents</p>
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-1 text-xl font-bold">{agents.length}</p>
          </CardContent>
        </Card>
        <Card className="animate-card-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Commissions</p>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-1 text-xl font-bold">{fmt(totalCommissions)}</p>
          </CardContent>
        </Card>
        <Card className="animate-card-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Paid Out</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-600">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="animate-card-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Pending</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-1 text-xl font-bold text-amber-600">{fmt(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Agents List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserCheck className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">No agents yet. Add referral agents to track commissions.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {agentStats.map((agent) => (
              <Card key={agent.id} className="animate-card-in">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">{agent.email || agent.phone || "No contact"}</p>
                    </div>
                    <Badge variant="outline">{agent.commission_rate}%</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Referrals</p>
                      <p className="font-medium">{agent.bookingCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Earned</p>
                      <p className="font-semibold text-emerald-600">{fmt(agent.totalCommission)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Pending</p>
                      <p className="font-semibold text-amber-600">{fmt(agent.pendingCommission)}</p>
                    </div>
                  </div>

                  {/* Expandable bookings */}
                  {agent.bookingCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                    >
                      {expandedAgent === agent.id ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
                      {agent.bookingCount} booking{agent.bookingCount !== 1 ? "s" : ""}
                    </Button>
                  )}
                  {expandedAgent === agent.id && (
                    <div className="space-y-1.5 pt-1">
                      {agent.bookings.map((ba: any) => (
                        <div key={ba.id} className="flex items-center justify-between rounded border p-2 text-xs">
                          <div>
                            <p className="font-medium">{(ba.events as any)?.clients?.name || "—"}</p>
                            <p className="text-muted-foreground">
                              {(ba.events as any)?.event_type} · {format(parseISO((ba.events as any)?.event_date), "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{fmt(Number(ba.commission_amount) || 0)}</span>
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 px-1.5 text-[10px] ${ba.commission_paid ? "text-emerald-600" : "text-amber-600"}`}
                                onClick={() => togglePaid.mutate({ id: ba.id, paid: !ba.commission_paid })}
                              >
                                {ba.commission_paid ? <><CheckCircle2 className="h-3 w-3 mr-0.5" />Paid</> : <><Clock className="h-3 w-3 mr-0.5" />Pending</>}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isOwner && (
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => openEdit(agent)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9 text-destructive" onClick={() => deleteMutation.mutate(agent.id)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Default Rate</TableHead>
                    <TableHead className="text-center">Referrals</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    {isOwner && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentStats.map((agent) => (
                    <>
                      <TableRow
                        key={agent.id}
                        className="animate-row-in cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {agent.bookingCount > 0 && (expandedAgent === agent.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />)}
                            {agent.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{agent.email || agent.phone || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{agent.commission_rate}%</Badge>
                        </TableCell>
                        <TableCell className="text-center">{agent.bookingCount}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(agent.totalCommission)}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{fmt(agent.paidCommission)}</TableCell>
                        <TableCell className="text-right font-medium text-amber-600">{fmt(agent.pendingCommission)}</TableCell>
                        {isOwner && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(agent)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(agent.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      {/* Expanded booking rows */}
                      {expandedAgent === agent.id && agent.bookings.map((ba: any) => (
                        <TableRow key={ba.id} className="bg-muted/30">
                          <TableCell className="pl-10 text-sm">{(ba.events as any)?.clients?.name || "—"}</TableCell>
                          <TableCell className="text-sm capitalize">{(ba.events as any)?.event_type}</TableCell>
                          <TableCell className="text-center text-sm">{ba.commission_rate}%</TableCell>
                          <TableCell className="text-center text-sm">
                            {format(parseISO((ba.events as any)?.event_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmt(Number(ba.commission_amount) || 0)}</TableCell>
                          <TableCell colSpan={2} className="text-center" onClick={(e) => e.stopPropagation()}>
                            {isOwner ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 text-xs ${ba.commission_paid ? "text-emerald-600" : "text-amber-600"}`}
                                onClick={() => togglePaid.mutate({ id: ba.id, paid: !ba.commission_paid })}
                              >
                                {ba.commission_paid ? <><CheckCircle2 className="h-3 w-3 mr-1" />Paid</> : <><Clock className="h-3 w-3 mr-1" />Mark Paid</>}
                              </Button>
                            ) : (
                              <Badge variant="outline" className={ba.commission_paid ? "bg-emerald-500/15 text-emerald-700 border-emerald-200" : "bg-amber-500/15 text-amber-700 border-amber-200"}>
                                {ba.commission_paid ? "Paid" : "Pending"}
                              </Badge>
                            )}
                          </TableCell>
                          {isOwner && <TableCell />}
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Agent" : "Add Agent"}</DialogTitle>
            <DialogDescription>External referral agents who earn commission on bookings they bring in.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Commission Rate (%)</Label>
              <Input type="number" min="0" max="100" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
              <p className="text-xs text-muted-foreground">This is pre-filled when assigning to bookings. Can be overridden per booking.</p>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-gold text-primary-foreground font-semibold">
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
