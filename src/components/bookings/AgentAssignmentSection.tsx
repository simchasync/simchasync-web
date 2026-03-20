import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserCheck, Plus, Trash2, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AgentAssignmentSectionProps {
  eventId: string;
  canWrite: boolean;
  totalPrice: number;
}

export default function AgentAssignmentSection({ eventId, canWrite, totalPrice }: AgentAssignmentSectionProps) {
  const { tenantId } = useTenantId();
  const qc = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [customRate, setCustomRate] = useState("");

  const { data: agents = [] } = useQuery({
    queryKey: ["agents", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("*").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: assignedAgents = [] } = useQuery({
    queryKey: ["booking-agents", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents")
        .select("*, agents(name, commission_rate)")
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const assignAgent = useMutation({
    mutationFn: async () => {
      const agent = agents.find((a) => a.id === selectedAgent);
      if (!agent) throw new Error("Select an agent");
      const rate = customRate ? Number(customRate) : agent.commission_rate;
      const amount = totalPrice > 0 ? Math.round((totalPrice * rate) / 100 * 100) / 100 : 0;
      const { error } = await supabase.from("booking_agents").insert({
        event_id: eventId,
        agent_id: selectedAgent,
        commission_rate: rate,
        commission_amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-agents", eventId] });
      setSelectedAgent("");
      setCustomRate("");
      toast({ title: "Agent assigned" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booking_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-agents", eventId] });
      toast({ title: "Agent removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCommission = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const amount = totalPrice > 0 ? Math.round((totalPrice * rate) / 100 * 100) / 100 : 0;
      const { error } = await supabase.from("booking_agents").update({ commission_rate: rate, commission_amount: amount }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-agents", eventId] });
    },
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("booking_agents").update({ commission_paid: paid } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-agents", eventId] });
    },
  });

  const availableAgents = agents.filter((a) => !assignedAgents.some((ba: any) => ba.agent_id === a.id));
  const totalCommission = assignedAgents.reduce((s: number, ba: any) => s + (Number(ba.commission_amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <UserCheck className="h-4 w-4 text-primary" />
          Referral Agents
        </h3>
        {totalCommission > 0 && (
          <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-200">
            <DollarSign className="h-3 w-3 mr-0.5" />{totalCommission.toLocaleString()} commission
          </Badge>
        )}
      </div>

      {assignedAgents.length > 0 && (
        <div className="space-y-2">
          {assignedAgents.map((ba: any) => (
            <div key={ba.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{ba.agents?.name || "Agent"}</p>
                  {(ba as any).commission_paid ? (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Paid
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />Pending
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {ba.commission_rate}% = ${Number(ba.commission_amount || 0).toLocaleString()}
                </p>
              </div>
              {canWrite && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground">Paid</Label>
                    <Switch
                      checked={!!(ba as any).commission_paid}
                      onCheckedChange={(checked) => togglePaid.mutate({ id: ba.id, paid: checked })}
                      className="scale-75"
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => removeAgent.mutate(ba.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && availableAgents.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Agent</Label>
            <Select value={selectedAgent} onValueChange={(v) => {
              setSelectedAgent(v);
              const agent = agents.find(a => a.id === v);
              if (agent) setCustomRate(String(agent.commission_rate));
            }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select agent..." /></SelectTrigger>
              <SelectContent>
                {availableAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.commission_rate}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs">Rate %</Label>
            <Input className="h-9" type="number" min="0" max="100" placeholder="%" value={customRate} onChange={(e) => setCustomRate(e.target.value)} />
          </div>
          <Button size="sm" className="h-9" disabled={!selectedAgent} onClick={() => assignAgent.mutate()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {agents.length === 0 && (
        <p className="text-xs text-muted-foreground">No agents created yet. Add agents from the Agents page.</p>
      )}
    </div>
  );
}
