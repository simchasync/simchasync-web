import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Users, UserPlus, Check, X, Clock, Zap, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";

interface ColleaguesSectionProps {
  eventId: string;
  canWrite: boolean;
  tenantId: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Check; color: string; label: string }> = {
  auto_assigned: { icon: Zap, color: "bg-blue-500/15 text-blue-700 border-blue-200", label: "Auto-Assigned" },
  pending: { icon: Clock, color: "bg-amber-500/15 text-amber-700 border-amber-200", label: "Pending" },
  accepted: { icon: Check, color: "bg-emerald-500/15 text-emerald-700 border-emerald-200", label: "Accepted" },
  rejected: { icon: X, color: "bg-red-500/15 text-red-700 border-red-200", label: "Rejected" },
};

const emptyColleague = {
  name: "",
  role_instrument: "",
  phone: "",
  email: "",
  notes: "",
  price: "0",
  payment_responsibility: "paid_by_me",
};

export default function ColleaguesSection({ eventId, canWrite, tenantId }: ColleaguesSectionProps) {
  const qc = useQueryClient();
  const { role } = useUserRole();
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedColleague, setSelectedColleague] = useState<any>(null);
  const [autoAssign, setAutoAssign] = useState(true);
  const [colleagueType, setColleagueType] = useState<"internal" | "external">("internal");
  const [newContact, setNewContact] = useState({ full_name: "", role_instrument: "", phone: "", email: "", notes: "", default_price: "0" });

  const { data: eventColleagues = [] } = useQuery({
    queryKey: ["event-colleagues", eventId, role, canWrite],
    queryFn: async () => {
      if (!canWrite && role === "member") {
        const { data, error } = await (supabase.rpc as any)("get_member_event_colleagues", {
          _event_id: eventId,
        });
        if (error) throw error;
        return data ?? [];
      }

      const { data, error } = await supabase
        .from("event_colleagues")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for live status updates
  useEffect(() => {
    const channel = supabase
      .channel(`event-colleagues-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_colleagues", filter: `event_id=eq.${eventId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["event-colleagues", eventId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, qc]);

  const { data: savedColleagues = [] } = useQuery({
    queryKey: ["colleagues", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colleagues")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && canWrite,
  });

  const addMutation = useMutation({
    mutationFn: async (values: typeof emptyColleague & {
      colleague_id?: string;
      user_id?: string | null;
      colleague_type?: string;
      invite_status?: string;
    }) => {
      const isInternal = (values.colleague_type ?? "internal") === "internal";
      const isExternal = !isInternal;
      const status = values.invite_status ?? "auto_assigned";
      let linkedUserId = values.user_id ?? null;

      // ═══════════════════════════════════════════════════════════
      // EXTERNAL FLOW — COMPLETELY DECOUPLED FROM WORKSPACE SYSTEM
      // ═══════════════════════════════════════════════════════════
      if (isExternal) {
        console.log("[EXTERNAL_FLOW] external_flow_triggered = true", {
          colleague_id: values.colleague_id,
          email: values.email,
          event_id: eventId,
        });

        // GUARD: BLOCK any workspace/team creation for externals
        // External colleagues are NEVER added as workspace members
        // External colleagues are NEVER assigned bookings directly
        // They receive booking_requests ONLY

        // Step 1: Insert tracking row as external_collaborator (NOT workspace_member)
        const insertPayload = {
          event_id: eventId,
          colleague_id: values.colleague_id || null,
          user_id: null, // CRITICAL: Never link user_id for externals — prevents workspace access
          name: values.name,
          role_instrument: values.role_instrument || null,
          phone: values.phone || null,
          email: values.email || null,
          notes: values.notes || null,
          price: Number(values.price) || 0,
          payment_responsibility: values.payment_responsibility,
          colleague_type: "external_collaborator", // NOT "internal", NOT "external"
          invite_status: "pending",
        };

        const { data: ecRow, error: ecError } = await supabase
          .from("event_colleagues")
          .insert(insertPayload as any)
          .select("id")
          .single();
        if (ecError) {
          if (ecError.code === "23505") throw new Error("This colleague is already assigned to this booking");
          throw ecError;
        }

        console.log("[EXTERNAL_FLOW] event_colleagues row created (tracking only)", { ecId: ecRow.id });

        // GUARD: Verify no workspace_created event fired
        console.log("[EXTERNAL_FLOW] workspace_created = false (blocked)");

        // Step 2: Find external user's EXISTING workspace — NEVER create a new one
        if (values.email) {
          const normalizedEmail = values.email.trim().toLowerCase();
          const { data: extProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .ilike("email", normalizedEmail)
            .maybeSingle();

          if (extProfile?.user_id) {
            console.log("[EXTERNAL_FLOW] external user lookup", {
              found: true,
              user_id: extProfile.user_id,
              workspace_created: false,
            });

            if (values.colleague_id) {
              await supabase
                .from("colleagues")
                .update({ user_id: null } as any)
                .eq("id", values.colleague_id)
                .eq("tenant_id", tenantId);
            }

            // Find their EXISTING tenant — do NOT create one
            const { data: extTenantId } = await supabase.rpc("get_user_tenant_id", {
              _user_id: extProfile.user_id,
            });

            if (extTenantId) {
              // Get source event details
              const { data: sourceEvent } = await supabase
                .from("events")
                .select("event_date, event_type, venue, location, notes, tenant_id")
                .eq("id", eventId)
                .single();

              const { data: sourceTenant } = await supabase
                .from("tenants")
                .select("name")
                .eq("id", tenantId)
                .single();

              // Step 3: Create booking_request (NOT assignment, NOT team membership)
              // Generate ID client-side since RLS prevents reading back from external workspace
              const bookingRequestId = crypto.randomUUID();
              const { error: brError } = await supabase
                .from("booking_requests")
                .insert({
                  id: bookingRequestId,
                  tenant_id: extTenantId,
                  name: sourceTenant?.name || "External Booking",
                  email: values.email,
                  phone: values.phone || null,
                  event_date: sourceEvent?.event_date || null,
                  event_type: sourceEvent?.event_type || "wedding",
                  message: `Incoming booking request from ${sourceTenant?.name || "another workspace"} — Role: ${values.role_instrument || "Colleague"}${sourceEvent?.venue ? `, Venue: ${sourceEvent.venue}` : ""}${sourceEvent?.notes ? `\n\nNotes: ${sourceEvent.notes}` : ""}`,
                  status: "new",
                  source_event_id: eventId,
                  source_tenant_id: tenantId,
                  source_colleague_id: ecRow.id,
                  price: values.price || null,
                } as any);

              console.log("[EXTERNAL_FLOW] booking_request created", {
                success: !brError,
                error: brError?.message,
                booking_request_id: brError ? null : bookingRequestId,
                target_workspace: extTenantId,
              });

              if (!brError) {
                await supabase
                  .from("event_colleagues")
                  .update({ booking_request_id: bookingRequestId } as any)
                  .eq("id", ecRow.id);
              }

              // In-app notification
              await supabase.from("notifications").insert({
                tenant_id: extTenantId,
                user_id: extProfile.user_id,
                title: "Incoming Booking Request",
                message: `${sourceTenant?.name || "A workspace"} has sent you a booking request as ${values.role_instrument || "colleague"} for ${sourceEvent?.event_type || "an event"} on ${sourceEvent?.event_date || "TBD"}`,
                type: "booking",
                link: "/app/bookings",
              });

              // Email notification (fire & forget)
              supabase.functions.invoke("send-notification-email", {
                body: {
                  type: "external_booking_request",
                  tenant_id: extTenantId,
                  recipient_email: values.email,
                  subject: `Incoming Booking Request from ${sourceTenant?.name || "a workspace"}`,
                  body_html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #1a1a2e;">Incoming Booking Request</h2>
                      <p>You've received a booking request from <strong>${sourceTenant?.name || "another workspace"}</strong>.</p>
                      <p>Role: <strong>${values.role_instrument || "Colleague"}</strong></p>
                      ${sourceEvent?.event_type ? `<p>Event: <strong>${sourceEvent.event_type}</strong></p>` : ""}
                      ${sourceEvent?.event_date ? `<p>Date: <strong>${sourceEvent.event_date}</strong></p>` : ""}
                      ${sourceEvent?.venue ? `<p>Venue: <strong>${sourceEvent.venue}</strong></p>` : ""}
                      <p>Log in to your workspace to accept or decline this request.</p>
                    </div>`,
                },
              }).catch(console.warn);
            } else {
              console.warn("[EXTERNAL_FLOW] External user has no workspace — request not sent. User must register first.");
            }
          } else {
            console.warn("[EXTERNAL_FLOW] No user found with email:", values.email, "— booking request not sent.");
          }
        }

        return { status: "pending", isInternal: false };
      }

      // INTERNAL: Only invite to workspace for internal colleagues who aren't auto-assigned
      if (isInternal && values.email && status === "pending") {
        const { data, error } = await supabase.functions.invoke("invite-team-member", {
          body: { email: values.email, tenant_id: tenantId, role: "member" },
        });

        if (error) {
          try {
            const body = await (error as any).context?.json?.() ?? JSON.parse((error as any).message || "{}");
            if (body?.error) throw new Error(body.error);
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
          }
          throw new Error(data?.error || error.message || "Failed to invite colleague");
        }

        if (data?.error) throw new Error(data.error);
        linkedUserId = data?.user_id ?? linkedUserId;

        if (values.colleague_id && linkedUserId) {
          await supabase
            .from("colleagues")
            .update({ user_id: linkedUserId } as any)
            .eq("id", values.colleague_id);
        }
      }

      // For auto-assigned internal with email, still link user
      if (isInternal && values.email && status === "auto_assigned") {
        const { data, error } = await supabase.functions.invoke("invite-team-member", {
          body: { email: values.email, tenant_id: tenantId, role: "member" },
        });
        if (!error && data?.user_id) {
          linkedUserId = data.user_id;
          if (values.colleague_id && linkedUserId) {
            await supabase
              .from("colleagues")
              .update({ user_id: linkedUserId } as any)
              .eq("id", values.colleague_id);
          }
        }
      }

      const insertPayload = {
        event_id: eventId,
        colleague_id: values.colleague_id || null,
        user_id: linkedUserId,
        name: values.name,
        role_instrument: values.role_instrument || null,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
        price: Number(values.price) || 0,
        payment_responsibility: values.payment_responsibility,
        colleague_type: "internal",
        invite_status: values.invite_status ?? "auto_assigned",
      };

      const { error } = await supabase.from("event_colleagues").insert(insertPayload as any);
      if (error) {
        if (error.code === "23505") throw new Error("This colleague is already assigned to this booking");
        throw error;
      }

      return { status, isInternal: true };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["event-colleagues", eventId] });
      qc.invalidateQueries({ queryKey: ["colleagues", tenantId] });
      qc.invalidateQueries({ queryKey: ["events", tenantId] });

    if (!result?.isInternal) {
        toast({
          title: "Booking request sent",
          description: "An external booking request has been created in the colleague's workspace.",
        });
      } else if (result?.status === "pending") {
        toast({
          title: "Invitation sent",
          description: "The colleague has been invited and will need to accept.",
        });
      } else if (result?.status === "auto_assigned") {
        toast({ title: "Colleague assigned", description: "Automatically assigned to this booking." });
      } else {
        toast({ title: "Colleague added" });
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find the colleague row first to check for linked booking_request
      const ec = eventColleagues.find((c: any) => c.id === id);
      const isExt = ec?.colleague_type === "external_collaborator" || ec?.colleague_type === "external";

      // If external with a linked booking_request, delete that first
      if (isExt && ec?.booking_request_id) {
        await supabase.from("booking_requests").delete().eq("id", ec.booking_request_id);
        console.log("[EXTERNAL_FLOW] Deleted linked booking_request", { booking_request_id: ec.booking_request_id });
      }

      const { error } = await supabase.from("event_colleagues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-colleagues", eventId] });
      qc.invalidateQueries({ queryKey: ["events", tenantId] });
      toast({ title: "Colleague removed" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | number }) => {
      const { error } = await supabase.from("event_colleagues").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-colleagues", eventId] });
      qc.invalidateQueries({ queryKey: ["events", tenantId] });
    },
  });

  // Accept/reject mutation for assigned colleagues
  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" }) => {
      const { error } = await supabase
        .from("event_colleagues")
        .update({ invite_status: status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["event-colleagues", eventId] });
      toast({ title: vars.status === "accepted" ? "Invitation accepted" : "Invitation declined" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveNewContactMutation = useMutation({
    mutationFn: async (values: typeof newContact) => {
      const { data, error } = await supabase.from("colleagues").insert({
        tenant_id: tenantId,
        full_name: values.full_name,
        role_instrument: values.role_instrument || null,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
        default_price: Number(values.default_price) || 0,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["colleagues", tenantId] });
      setAddDialogOpen(false);
      setNewContact({ full_name: "", role_instrument: "", phone: "", email: "", notes: "", default_price: "0" });
      // Open the assignment dialog for the newly created colleague
      setSelectedColleague(data);
      setAssignDialogOpen(true);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSelectColleague = (colleague: any) => {
    setSelectedColleague(colleague);
    setAutoAssign(true);
    setColleagueType("internal");
    setAssignDialogOpen(true);
  };

  const handleConfirmAssignment = () => {
    if (!selectedColleague) return;

    // GUARD: External colleagues NEVER get auto_assigned or workspace access
    const isExt = colleagueType === "external";
    const inviteStatus = isExt ? "pending" : (autoAssign ? "auto_assigned" : "pending");

    // GUARD: Log and validate
    if (isExt) {
      console.log("[EXTERNAL_GUARD] Blocking direct assignment. Using booking_request flow.", {
        colleague: selectedColleague.full_name,
        email: selectedColleague.email,
      });
    }

    addMutation.mutate({
      name: selectedColleague.full_name,
      role_instrument: selectedColleague.role_instrument || "",
      phone: selectedColleague.phone || "",
      email: selectedColleague.email || "",
      notes: selectedColleague.notes || "",
      price: String(selectedColleague.default_price || 0),
      payment_responsibility: "paid_by_me",
      colleague_id: selectedColleague.id,
      user_id: isExt ? null : (selectedColleague.user_id ?? null), // GUARD: Never pass user_id for external
      colleague_type: isExt ? "external" : "internal",
      invite_status: inviteStatus,
    });

    setAssignDialogOpen(false);
    setSelectedColleague(null);
  };

  const currentUserId = user?.id;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 font-semibold text-sm">
          <Users className="h-4 w-4 text-primary" />
          Musicians / Colleagues ({eventColleagues.length})
        </h4>
        {canWrite && (
          <ColleagueAdder
            savedColleagues={savedColleagues}
            onSelect={handleSelectColleague}
            onAddNew={() => setAddDialogOpen(true)}
          />
        )}
      </div>

      {eventColleagues.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No colleagues added yet.</p>
      ) : (
        <div className="space-y-2">
          {eventColleagues.map((ec: any) => (
            <ColleagueCard
              key={ec.id}
              ec={ec}
              canWrite={canWrite}
              currentUserId={currentUserId}
              onDelete={(id) => deleteMutation.mutate(id)}
              onUpdate={(id, field, value) => updateMutation.mutate({ id, field, value })}
              onRespond={(id, status) => respondMutation.mutate({ id, status })}
            />
          ))}
        </div>
      )}

      {/* Assignment options dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign {selectedColleague?.full_name}</DialogTitle>
            <DialogDescription>Choose how to assign this colleague to the booking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Colleague Type</Label>
              <Select value={colleagueType} onValueChange={(v: "internal" | "external") => setColleagueType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (workspace member)</SelectItem>
                  <SelectItem value="external">External (independent)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {colleagueType === "internal"
                  ? "Will be added to your workspace and can view booking details."
                  : "A booking request will be sent to their workspace. No workspace access granted."}
              </p>
            </div>

            {colleagueType === "internal" && (
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Auto-assign</Label>
                  <p className="text-xs text-muted-foreground">
                    {autoAssign ? "Directly assign without approval" : "Send invite, requires accept/reject"}
                  </p>
                </div>
                <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmAssignment} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Sending..." : colleagueType === "external" ? "Send Booking Request" : autoAssign ? "Assign" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add new colleague contact dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Colleague</DialogTitle>
            <DialogDescription>Save this colleague to your contacts database.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={newContact.full_name} onChange={(e) => setNewContact({ ...newContact, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role / Instrument</Label>
                <Input value={newContact.role_instrument} onChange={(e) => setNewContact({ ...newContact, role_instrument: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Default Price ($)</Label>
                <Input type="number" min="0" value={newContact.default_price} onChange={(e) => setNewContact({ ...newContact, default_price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={newContact.notes} onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button disabled={!newContact.full_name.trim() || saveNewContactMutation.isPending} onClick={() => saveNewContactMutation.mutate(newContact)}>
              {saveNewContactMutation.isPending ? "Saving..." : "Save & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Colleague Card ---------- */

function ColleagueCard({
  ec,
  canWrite,
  currentUserId,
  onDelete,
  onUpdate,
  onRespond,
}: {
  ec: any;
  canWrite: boolean;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: string, value: string | number) => void;
  onRespond: (id: string, status: "accepted" | "rejected") => void;
}) {
  const status = ec.invite_status ?? "auto_assigned";
  const type = ec.colleague_type ?? "internal";
  const isExternalCollab = type === "external_collaborator" || type === "external";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.auto_assigned;
  const StatusIcon = config.icon;
  // GUARD: External collaborators NEVER have user_id linked, so isOwnInvite is always false for them
  const isOwnInvite = !isExternalCollab && ec.user_id === currentUserId && status === "pending";

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{ec.name || "Unnamed"}</p>
          <Badge variant="outline" className={`${config.color} text-[10px] px-1.5 py-0`}>
            <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
            {config.label}
          </Badge>
          {isExternalCollab && (
            <Badge variant="outline" className="bg-violet-500/15 text-violet-700 border-violet-200 text-[10px] px-1.5 py-0">
              <ExternalLink className="h-2.5 w-2.5 mr-0.5" />
              External Request
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOwnInvite && (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs text-emerald-700" onClick={() => onRespond(ec.id, "accepted")}>
                <Check className="mr-1 h-3 w-3" /> Accept
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs text-red-700" onClick={() => onRespond(ec.id, "rejected")}>
                <X className="mr-1 h-3 w-3" /> Decline
              </Button>
            </>
          )}
          {canWrite && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(ec.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          {canWrite ? (
            <Input className="h-7 text-xs" defaultValue={ec.name || ""} onBlur={(e) => onUpdate(ec.id, "name", e.target.value)} />
          ) : (
            <p className="font-medium">{ec.name || "—"}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Role / Instrument</Label>
          {canWrite ? (
            <Input className="h-7 text-xs" defaultValue={ec.role_instrument || ""} onBlur={(e) => onUpdate(ec.id, "role_instrument", e.target.value)} />
          ) : (
            <p className="font-medium">{ec.role_instrument || "—"}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Phone</Label>
          {canWrite ? (
            <Input className="h-7 text-xs" defaultValue={ec.phone || ""} onBlur={(e) => onUpdate(ec.id, "phone", e.target.value)} />
          ) : (
            <p className="font-medium">{ec.phone || "—"}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          {canWrite ? (
            <Input className="h-7 text-xs" defaultValue={ec.email || ""} onBlur={(e) => onUpdate(ec.id, "email", e.target.value)} />
          ) : (
            <p className="font-medium">{ec.email || "—"}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Price ($)</Label>
          {canWrite ? (
            <Input className="h-7 text-xs" type="number" min="0" defaultValue={ec.price || 0} onBlur={(e) => onUpdate(ec.id, "price", Number(e.target.value))} />
          ) : (
            <p className="font-medium">${ec.price || 0}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Payment</Label>
          {canWrite ? (
            <Select value={ec.payment_responsibility} onValueChange={(v) => onUpdate(ec.id, "payment_responsibility", v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid_by_me">Paid by Me</SelectItem>
                <SelectItem value="paid_by_organizer">Paid by Organizer</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="font-medium">{ec.payment_responsibility === "paid_by_me" ? "Paid by Me" : "Paid by Organizer"}</p>
          )}
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs text-muted-foreground">Notes</Label>
          {canWrite ? (
            <Input className="h-7 text-xs" defaultValue={ec.notes || ""} onBlur={(e) => onUpdate(ec.id, "notes", e.target.value)} />
          ) : (
            <p className="font-medium">{ec.notes || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Colleague Adder Popover ---------- */

function ColleagueAdder({ savedColleagues, onSelect, onAddNew }: { savedColleagues: any[]; onSelect: (c: any) => void; onAddNew: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Plus className="mr-1 h-3 w-3" /> Add Colleague
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search colleagues..." />
          <CommandList>
            <CommandEmpty>No colleagues found.</CommandEmpty>
            <CommandGroup>
              {savedColleagues.map((c: any) => (
                <CommandItem key={c.id} onSelect={() => { onSelect(c); setOpen(false); }}>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{c.full_name}</span>
                    <span className="text-xs text-muted-foreground">{c.role_instrument || "No role"} · ${c.default_price || 0}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup>
              <CommandItem onSelect={() => { onAddNew(); setOpen(false); }}>
                <UserPlus className="mr-2 h-4 w-4" />
                <span className="font-medium">Add New Colleague</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
