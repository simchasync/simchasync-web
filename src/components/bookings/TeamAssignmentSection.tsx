import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/hooks/useTenantId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Users, Check, X, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ROLE_PRESETS = [
  "Pianist", "Singer", "DJ", "Photographer", "Videographer",
  "Host", "Staff", "Guitarist", "Drummer", "Bassist",
  "Violinist", "Sound Engineer", "Lighting", "Other",
] as const;

interface Props {
  eventId: string;
  canWrite: boolean;
}

const statusConfig: Record<string, { icon: typeof Check; color: string; label: string }> = {
  pending: { icon: Clock, color: "bg-yellow-100 text-yellow-800", label: "Pending" },
  accepted: { icon: Check, color: "bg-green-100 text-green-800", label: "Accepted" },
  declined: { icon: X, color: "bg-red-100 text-red-800", label: "Declined" },
};

export default function TeamAssignmentSection({ eventId, canWrite }: Props) {
  const { user } = useAuth();
  const { tenantId } = useTenantId();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", user_id: "", cost: "0", notes: "" });

  const { data: assignments = [] } = useQuery({
    queryKey: ["event-team", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_team_members")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Fetch workspace members for assignment
  const { data: members = [] } = useQuery({
    queryKey: ["team-members-for-assign", tenantId],
    queryFn: async () => {
      const { data: tm, error } = await supabase
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", tenantId!)
        .eq("invitation_status", "accepted");
      if (error) throw error;
      const userIds = tm.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      return profiles || [];
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`event-team-live-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_team_members", filter: `event_id=eq.${eventId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["event-team", eventId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  const addMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("event_team_members").insert({
        event_id: eventId,
        user_id: values.user_id || null,
        name: values.name || null,
        role: values.role || null,
        cost: Number(values.cost) || 0,
        notes: values.notes || null,
        invitation_status: values.user_id ? "pending" : "accepted",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-team", eventId] });
      setAddOpen(false);
      setForm({ name: "", role: "", user_id: "", cost: "0", notes: "" });
      toast({ title: "Teammate assigned" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("event_team_members")
        .update({ invitation_status: status, responded_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["event-team", eventId] });
      toast({ title: status === "accepted" ? "Booking accepted!" : "Booking declined" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-team", eventId] });
      toast({ title: "Teammate removed" });
    },
  });

  const handleSelectMember = (userId: string) => {
    const profile = members.find((m) => m.user_id === userId);
    setForm({
      ...form,
      user_id: userId,
      name: profile?.full_name || profile?.email || "",
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 font-semibold text-sm">
          <Users className="h-4 w-4 text-primary" />
          Assigned Teammates ({assignments.length})
        </h4>
        {canWrite && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Assign Teammate
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No teammates assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a: any) => {
            const statusInfo = statusConfig[a.invitation_status] || statusConfig.pending;
            const StatusIcon = statusInfo.icon;
            const isCurrentUser = a.user_id === user?.id;

            return (
              <Card key={a.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{a.name || "Unnamed"}</p>
                      <Badge variant="outline" className={statusInfo.color}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {a.role && <span>{a.role}</span>}
                      {a.cost > 0 && <span>${a.cost}</span>}
                      {a.notes && <span className="truncate">{a.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Accept/Decline buttons for current user */}
                    {isCurrentUser && a.invitation_status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => respondMutation.mutate({ id: a.id, status: "accepted" })}
                        >
                          <Check className="mr-1 h-3 w-3" /> Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() => respondMutation.mutate({ id: a.id, status: "declined" })}
                        >
                          <X className="mr-1 h-3 w-3" /> Decline
                        </Button>
                      </>
                    )}
                    {canWrite && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(a.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Teammate Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Teammate</DialogTitle>
            <DialogDescription>Select a workspace member or add by name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Workspace Member (optional)</Label>
              <Select value={form.user_id} onValueChange={handleSelectMember}>
                <SelectTrigger><SelectValue placeholder="Select member..." /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Teammate name" />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                <SelectContent>
                  {ROLE_PRESETS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cost ($)</Label>
                <Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.name.trim() || !form.role || addMutation.isPending}
              onClick={() => addMutation.mutate(form)}
            >
              {addMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
