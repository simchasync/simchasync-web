import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGridSkeleton } from "@/components/ui/page-skeletons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/hooks/useTenantId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, UsersRound, Users, Pencil, LogOut, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

type TenantRole = "owner" | "booking_manager" | "social_media_manager" | "member";
type InvitationStatus = "invited" | "accepted";

interface TeamMember {
  id: string;
  role: TenantRole;
  user_id: string;
  created_at: string;
  invitation_status: InvitationStatus;
  invitation_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  profile?: { full_name: string | null; email: string | null; avatar_url: string | null };
}

export default function Team() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { tenantId, userTenants, switchTenant } = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tm = t.app.team;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantRole>("booking_manager");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Colleague management state
  const [colleagueDialogOpen, setColleagueDialogOpen] = useState(false);
  const [editingColleague, setEditingColleague] = useState<any>(null);
  const [colleagueForm, setColleagueForm] = useState({
    full_name: "", role_instrument: "", phone: "", email: "", notes: "", default_price: "0",
  });

  // Fetch team members (internal staff)
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_members")
        .select("id, role, user_id, created_at, invitation_status, invitation_email, invited_at, accepted_at")
        .eq("tenant_id", tenantId!)
        .order("created_at");
      if (error) throw error;

      const userIds = Array.from(new Set(data.map((m) => m.user_id).filter(Boolean)));
      const profiles = userIds.length
        ? (await supabase.from("profiles").select("user_id, full_name, email, avatar_url").in("user_id", userIds)).data ?? []
        : [];

      const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
      return data.map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })) as TeamMember[];
    },
    enabled: !!tenantId,
  });

  // Realtime subscription for tenant_members changes
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`team-members-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tenant_members", filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  // Fetch colleagues (external performers)
  const { data: colleagues = [], isLoading: colleaguesLoading } = useQuery({
    queryKey: ["colleagues", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colleagues")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: colleagueAssignments = [] } = useQuery({
    queryKey: ["colleague-assignments", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_colleagues")
        .select("id, colleague_id, role_instrument, name, event_id, events!inner(id, event_date, event_type, tenant_id)")
        .eq("events.tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Filter: teammates = non-member roles (owner, booking_manager, social_media_manager)
  const teammates = members.filter((m) => m.role !== "member");
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;
  const isOwner = currentUserRole === "owner";

  const [colleagueSearch, setColleagueSearch] = useState("");
  const [colleagueSort, setColleagueSort] = useState<"name_asc" | "name_desc" | "assigned_desc">("assigned_desc");

  const colleagueAssignmentsMap = useMemo(() => {
    const map = new Map<string, { total: number; items: Array<{ event_id: string; event_date: string; event_type: string; role: string }> }>();

    for (const assignment of colleagueAssignments as any[]) {
      const colleagueId = assignment.colleague_id as string | null;
      if (!colleagueId) continue;

      const event = assignment.events as any;
      if (!event?.id) continue;

      const current = map.get(colleagueId) ?? { total: 0, items: [] };
      current.total += 1;
      current.items.push({
        event_id: event.id,
        event_date: event.event_date,
        event_type: event.event_type,
        role: assignment.role_instrument || "No role",
      });
      map.set(colleagueId, current);
    }

    return map;
  }, [colleagueAssignments]);

  const filteredColleagues = useMemo(() => {
    const q = colleagueSearch.trim().toLowerCase();
    const base = q
      ? colleagues.filter((c: any) =>
          [c.full_name, c.email, c.role_instrument, c.phone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        )
      : [...colleagues];

    base.sort((a: any, b: any) => {
      if (colleagueSort === "assigned_desc") {
        const aCount = colleagueAssignmentsMap.get(a.id)?.total ?? 0;
        const bCount = colleagueAssignmentsMap.get(b.id)?.total ?? 0;
        if (bCount !== aCount) return bCount - aCount;
        return String(a.full_name).localeCompare(String(b.full_name));
      }

      const order = String(a.full_name).localeCompare(String(b.full_name));
      return colleagueSort === "name_desc" ? -order : order;
    });

    return base;
  }, [colleagues, colleagueSearch, colleagueSort, colleagueAssignmentsMap]);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: { email: inviteEmail, tenant_id: tenantId, role: inviteRole },
      });
      if (error) {
        try {
          const body = await (error as any).context?.json?.() ?? JSON.parse((error as any).message || "{}");
          if (body?.error) throw new Error(body.error);
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
        }
        throw new Error(data?.error || error.message || "Failed to invite member");
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.invited ? "Invitation sent!" : "Member updated!",
        description: "You have been invited to join the workspace. Please accept the invitation to access your role.",
      });
      queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("booking_manager");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("tenant_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: TenantRole }) => {
      const { error } = await supabase.from("tenant_members").update({ role }).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: ["team-members", tenantId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Leave workspace mutation
  const leaveWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_workspace", { _tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Left workspace", description: "You have been removed from this workspace." });
      setLeaveDialogOpen(false);
      const otherTenant = userTenants.find((t) => t.tenant_id !== tenantId);
      if (otherTenant) {
        switchTenant(otherTenant.tenant_id);
      } else {
        window.location.href = "/app";
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Delete workspace mutation (owner only)
  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_workspace", { _tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Workspace deleted", description: "This workspace was deleted successfully." });
      setDeleteDialogOpen(false);
      const otherTenant = userTenants.find((t) => t.tenant_id !== tenantId);
      if (otherTenant) {
        switchTenant(otherTenant.tenant_id);
      } else {
        window.location.href = "/app";
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Colleague CRUD
  const saveColleagueMutation = useMutation({
    mutationFn: async (values: typeof colleagueForm) => {
      const payload = {
        tenant_id: tenantId!,
        full_name: values.full_name,
        role_instrument: values.role_instrument || null,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
        default_price: Number(values.default_price) || 0,
      };
      if (editingColleague) {
        const { error } = await supabase.from("colleagues").update(payload).eq("id", editingColleague.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("colleagues").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colleagues", tenantId] });
      setColleagueDialogOpen(false);
      setEditingColleague(null);
      resetColleagueForm();
      toast({ title: editingColleague ? "Colleague updated" : "Colleague added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteColleagueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colleagues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colleagues", tenantId] });
      toast({ title: "Colleague removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetColleagueForm = () => setColleagueForm({ full_name: "", role_instrument: "", phone: "", email: "", notes: "", default_price: "0" });

  const openEditColleague = (c: any) => {
    setEditingColleague(c);
    setColleagueForm({
      full_name: c.full_name,
      role_instrument: c.role_instrument || "",
      phone: c.phone || "",
      email: c.email || "",
      notes: c.notes || "",
      default_price: String(c.default_price || 0),
    });
    setColleagueDialogOpen(true);
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "owner": return "bg-primary/20 text-primary border-primary/30";
      case "booking_manager": return "bg-blue-500/20 text-blue-700 border-blue-500/30";
      case "social_media_manager": return "bg-purple-500/20 text-purple-700 border-purple-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const roleDescription = (role: string) => {
    switch (role) {
      case "owner": return "Full workspace access";
      case "booking_manager": return "Bookings only with live sync";
      case "social_media_manager": return "Social media only";
      default: return "";
    }
  };

  const initials = (name: string | null | undefined) =>
    (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const statusBadgeClass = (status: InvitationStatus) =>
    status === "accepted"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-border bg-muted text-muted-foreground";

  const statusLabel = (status: InvitationStatus) =>
    status === "accepted" ? "Accepted" : "Invited";

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <TeamGridSkeleton count={3} />
      </div>
    );
  }

  const teammateRoles: TenantRole[] = ["owner", "booking_manager", "social_media_manager"];
  const canLeave = !isOwner && currentUserRole;
  const ownerCount = members.filter((m) => m.role === "owner").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{tm.title}</h1>
        <div className="flex items-center gap-2">
          {canLeave && (
            <Button variant="outline" size="sm" onClick={() => setLeaveDialogOpen(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Leave Workspace
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="teammates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="teammates">
            <UsersRound className="mr-1.5 h-3.5 w-3.5" /> Teammates
          </TabsTrigger>
          <TabsTrigger value="colleagues">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Colleagues
          </TabsTrigger>
        </TabsList>

        {/* ─── TEAMMATES TAB ─── */}
        <TabsContent value="teammates" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Internal staff who manage the platform. <strong>Admin</strong> = full access. <strong>Booking Manager</strong> = bookings &amp; clients only.
            </p>
            {isOwner && (
              <Button onClick={() => setInviteOpen(true)} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
                <Plus className="mr-2 h-4 w-4" /> {tm.invite}
              </Button>
            )}
          </div>

          {teammates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <UsersRound className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">No teammates yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teammates.map((m) => (
                <Card key={m.id} className="relative animate-card-in card-interactive">
                  <CardContent className="flex items-start gap-4 p-5">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={m.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {initials(m.profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{m.profile?.full_name || m.invitation_email || "—"}</p>
                      <p className="text-sm text-muted-foreground truncate">{m.profile?.email || m.invitation_email || "—"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {isOwner && m.user_id !== user?.id ? (
                          <Select
                            value={m.role}
                            onValueChange={(v) => updateRoleMutation.mutate({ memberId: m.id, role: v as TenantRole })}
                          >
                            <SelectTrigger className="h-7 w-auto text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["owner", "booking_manager", "social_media_manager"] as TenantRole[]).map((r) => (
                                <SelectItem key={r} value={r}>
                                  {tm.roles[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={roleBadgeColor(m.role)}>
                            {tm.roles[m.role as keyof typeof tm.roles]}
                          </Badge>
                        )}
                        <Badge variant="outline" className={statusBadgeClass(m.invitation_status)}>
                          {statusLabel(m.invitation_status)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{roleDescription(m.role)}</p>
                    </div>
                    {isOwner && m.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8 px-2.5 text-xs"
                        onClick={() => removeMutation.mutate(m.id)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── COLLEAGUES TAB ─── */}
        <TabsContent value="colleagues" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              External performers and service providers (Pianist, DJ, Guitarist, Singer, etc.) assigned to bookings.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Search colleagues..."
                value={colleagueSearch}
                onChange={(e) => setColleagueSearch(e.target.value)}
                className="h-9 w-full sm:w-56"
              />
              <Select value={colleagueSort} onValueChange={(v) => setColleagueSort(v as "name_asc" | "name_desc" | "assigned_desc") }>
                <SelectTrigger className="h-9 w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned_desc">Most assigned</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
              {isOwner && (
                <Button
                  onClick={() => { resetColleagueForm(); setEditingColleague(null); setColleagueDialogOpen(true); }}
                  className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Colleague
                </Button>
              )}
            </div>
          </div>

          {colleaguesLoading ? (
            <TeamGridSkeleton count={3} />
          ) : filteredColleagues.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">No colleagues found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredColleagues.map((c: any) => {
                const assignments = colleagueAssignmentsMap.get(c.id)?.items ?? [];
                const assignmentCount = colleagueAssignmentsMap.get(c.id)?.total ?? 0;

                return (
                  <Card key={c.id} className="animate-card-in card-interactive">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{c.full_name}</p>
                          <p className="text-sm text-muted-foreground">{c.role_instrument || "No role specified"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{assignmentCount} bookings</Badge>
                          {c.default_price > 0 && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              ${c.default_price}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {c.email && <p>✉ {c.email}</p>}
                        {c.phone && <p>📱 {c.phone}</p>}
                        {c.notes && <p className="truncate">📝 {c.notes}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Assigned bookings</p>
                        {assignments.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No assignments yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {assignments.slice(0, 4).map((a) => (
                              <div key={`${c.id}-${a.event_id}-${a.role}`} className="rounded-md border border-border px-2.5 py-1.5 text-xs">
                                <p className="font-medium truncate">{new Date(a.event_date).toLocaleDateString()} · {a.event_type}</p>
                                <p className="text-muted-foreground truncate">Role: {a.role}</p>
                              </div>
                            ))}
                            {assignments.length > 4 && (
                              <p className="text-[11px] text-muted-foreground">+{assignments.length - 4} more assignments</p>
                            )}
                          </div>
                        )}
                      </div>

                      {isOwner && (
                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openEditColleague(c)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-destructive hover:text-destructive" onClick={() => deleteColleagueMutation.mutate(c.id)}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Invite Teammate Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tm.invite}</DialogTitle>
            <DialogDescription>Send an invitation to join your workspace as a teammate. Admins get full access; Booking Managers can only manage bookings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.auth.email}</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
              />
            </div>
            <div>
              <Label>{tm.role}</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TenantRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teammateRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex flex-col">
                        <span>{tm.roles[r]}</span>
                        <span className="text-[11px] text-muted-foreground">{roleDescription(r)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t.common.cancel}</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || inviteMutation.isPending}
              className="bg-gradient-gold text-primary-foreground"
            >
              {inviteMutation.isPending ? t.common.loading : tm.invite}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Workspace Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" /> Leave Workspace
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to all bookings, clients, and data in this workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveWorkspaceMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaveWorkspaceMutation.isPending ? "Leaving..." : "Leave Workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Workspace Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Workspace
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all teammates from this workspace. All bookings, clients, invoices, and data will become inaccessible. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWorkspaceMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWorkspaceMutation.isPending ? "Deleting..." : "Delete Workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Colleague Dialog */}
      <Dialog open={colleagueDialogOpen} onOpenChange={setColleagueDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingColleague ? "Edit Colleague" : "Add Colleague"}</DialogTitle>
            <DialogDescription>
              {editingColleague ? "Update colleague details." : "Add a new external performer or service provider."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={colleagueForm.full_name} onChange={(e) => setColleagueForm({ ...colleagueForm, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role / Instrument</Label>
                <Input value={colleagueForm.role_instrument} onChange={(e) => setColleagueForm({ ...colleagueForm, role_instrument: e.target.value })} placeholder="e.g. Pianist, DJ" />
              </div>
              <div className="space-y-1.5">
                <Label>Default Price ($)</Label>
                <Input type="number" min="0" value={colleagueForm.default_price} onChange={(e) => setColleagueForm({ ...colleagueForm, default_price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={colleagueForm.phone} onChange={(e) => setColleagueForm({ ...colleagueForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={colleagueForm.email} onChange={(e) => setColleagueForm({ ...colleagueForm, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={colleagueForm.notes} onChange={(e) => setColleagueForm({ ...colleagueForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColleagueDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!colleagueForm.full_name.trim() || saveColleagueMutation.isPending}
              onClick={() => saveColleagueMutation.mutate(colleagueForm)}
            >
              {saveColleagueMutation.isPending ? "Saving..." : editingColleague ? "Update" : "Add Colleague"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
