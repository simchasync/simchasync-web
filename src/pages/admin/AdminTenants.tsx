import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search, Plus, ChevronDown, ChevronRight, Users, CalendarDays, Key,
  Loader2, Building2, RefreshCw, CreditCard, Clock, Eye, AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";

function adminAction(action: string, body: Record<string, any>) {
  return supabase.functions.invoke("admin-manage-tenant", {
    body: { action, ...body },
  });
}

const PLAN_PRICES: Record<string, string> = {
  trial: "Trial",
  lite: "$59.99/mo",
  full: "$89.99/mo",
};

const PAGE_SIZE = 50;

function getTrialInfo(t: any) {
  if (t.plan !== "trial") return { label: "Converted", variant: "success" as const };
  const now = new Date();
  const end = new Date(t.trial_ends_at);
  const created = new Date(t.created_at);
  const totalDays = Math.max(differenceInDays(end, created), 1);
  const dayNum = Math.max(differenceInDays(now, created) + 1, 1);
  if (now > end) return { label: "Expired", variant: "destructive" as const };
  return { label: `Day ${Math.min(dayNum, totalDays)} of ${totalDays}`, variant: "warning" as const };
}

function stripeStatusBadge(status: string | null) {
  if (!status) return <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">Not connected</Badge>;
  const colors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
    past_due: "bg-amber-500/10 text-amber-700 border-amber-300",
    canceled: "bg-destructive/10 text-destructive border-destructive/30",
    paused: "bg-blue-500/10 text-blue-700 border-blue-300",
  };
  return <Badge variant="outline" className={`text-[10px] ${colors[status] || ""}`}>{status}</Badge>;
}

function LoadingSkeleton() {
  return (
    <Card>
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AdminTenants() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canInviteTenants, canResetPasswords, canManageBilling, isAdmin, isSupportAgent } = useAdminRole();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPasswordValue] = useState("");
  const [editingTrial, setEditingTrial] = useState<{ id: string; value: string } | null>(null);
  const [editingPlan, setEditingPlan] = useState<{ id: string; value: string } | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ id: string; value: string } | null>(null);

  // Filters
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterTrialStatus, setFilterTrialStatus] = useState("all");
  const [filterStripeStatus, setFilterStripeStatus] = useState("all");

  // Debounced search
  const debounceTimer = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceTimer[0]) clearTimeout(debounceTimer[0]);
    debounceTimer[0] = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  }, []);

  const isSearching = debouncedSearch.length >= 2;

  // Main tenant list query (paginated)
  const { data: listData, isLoading: listLoading, error: listError } = useQuery({
    queryKey: ["admin-tenants", page],
    queryFn: async () => {
      const { data, error } = await adminAction("list_tenants", { page, page_size: PAGE_SIZE });
      if (error) throw new Error(error.message || "Failed to load tenants");
      if (data?.error) throw new Error(data.error);
      return data as { tenants: any[]; total: number; page: number; page_size: number };
    },
    enabled: !isSearching,
    staleTime: 30_000,
  });

  // Search query (deep search across name, email, ID)
  const { data: searchData, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: ["admin-tenants-search", debouncedSearch],
    queryFn: async () => {
      const { data, error } = await adminAction("search_tenants", { search: debouncedSearch });
      if (error) throw new Error(error.message || "Search failed");
      if (data?.error) throw new Error(data.error);
      return data as { tenants: any[]; total: number };
    },
    enabled: isSearching,
    staleTime: 10_000,
  });

  const isLoading = isSearching ? searchLoading : listLoading;
  const queryError = isSearching ? searchError : listError;
  const allTenants = isSearching ? (searchData?.tenants || []) : (listData?.tenants || []);
  const totalCount = isSearching ? (searchData?.total || 0) : (listData?.total || 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Client-side filters (applied on top of server results)
  const tenants = allTenants.filter((t: any) => {
    if (filterPlan !== "all" && t.plan !== filterPlan) return false;
    if (filterTrialStatus !== "all") {
      const info = getTrialInfo(t);
      if (filterTrialStatus === "active" && info.variant !== "warning") return false;
      if (filterTrialStatus === "expired" && info.label !== "Expired") return false;
      if (filterTrialStatus === "converted" && info.label !== "Converted") return false;
    }
    if (filterStripeStatus !== "all") {
      if (filterStripeStatus === "none" && t.stripe_subscription_status) return false;
      if (filterStripeStatus !== "none" && t.stripe_subscription_status !== filterStripeStatus) return false;
    }
    return true;
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, ...params }: any) => {
      const { data, error } = await adminAction(action, params);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants-search"] });
      toast({ title: "Done ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await adminAction("invite_tenant", {
        email: inviteEmail, password: invitePassword, full_name: inviteName,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast({ title: "Tenant invited ✓" });
      setInviteOpen(false);
      setInviteEmail(""); setInvitePassword(""); setInviteName("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      trial: "bg-amber-500/10 text-amber-700 border-amber-200",
      lite: "bg-blue-500/10 text-blue-700 border-blue-200",
      full: "bg-primary/10 text-primary border-primary/30",
    };
    return colors[plan] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Tenant Directory</h1>
          <p className="text-sm text-muted-foreground">
            {isSearching ? `${totalCount} results` : `${totalCount} total tenants`}
            {!isSearching && totalPages > 1 && ` · Page ${page} of ${totalPages}`}
          </p>
        </div>
        {canInviteTenants && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-gold text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" /> Invite New Tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Invite New Tenant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>Full Name</Label><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></div>
                <div><Label>Password (min 6)</Label><Input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} /></div>
                <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !inviteEmail || invitePassword.length < 6} className="w-full bg-gradient-gold text-primary-foreground">
                  {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Tenant Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, ID..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="lite">Lite</SelectItem>
            <SelectItem value="full">Full</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTrialStatus} onValueChange={setFilterTrialStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Trial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Trial Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStripeStatus} onValueChange={setFilterStripeStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Stripe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stripe</SelectItem>
            <SelectItem value="none">Not Connected</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {queryError && (
        <Card className="border-destructive/50 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Failed to load tenants</p>
              <p className="text-sm text-muted-foreground mt-1">{(queryError as Error).message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
                  queryClient.invalidateQueries({ queryKey: ["admin-tenants-search"] });
                }}
              >
                <RefreshCw className="mr-1 h-3 w-3" /> Retry
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : !queryError ? (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Stripe</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t: any) => {
                  const isExpanded = expandedTenant === t.id;
                  const members = t.tenant_members || [];
                  const owner = members.find((m: any) => m.role === "owner");
                  const ownerEmail = owner?.profiles?.email || "";
                  const trialInfo = getTrialInfo(t);
                  const mrrDisplay = t.stripe_mrr_cents ? `$${(t.stripe_mrr_cents / 100).toFixed(2)}` : "—";

                  return (
                    <Collapsible key={t.id} open={isExpanded} onOpenChange={() => setExpandedTenant(isExpanded ? null : t.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                            <TableCell>
                              <div className="font-medium">{t.name}</div>
                              <div className="text-xs text-muted-foreground">{ownerEmail}</div>
                              <div className="text-[10px] text-muted-foreground/60 font-mono">{t.id.slice(0, 8)}…</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={planBadge(t.plan)}>{t.plan}</Badge>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{PLAN_PRICES[t.plan] || ""}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${
                                trialInfo.variant === "destructive" ? "bg-destructive/10 text-destructive border-destructive/30" :
                                trialInfo.variant === "success" ? "bg-emerald-500/10 text-emerald-700 border-emerald-300" :
                                "bg-amber-500/10 text-amber-700 border-amber-200"
                              }`}>
                                {trialInfo.label}
                              </Badge>
                              {t.plan === "trial" && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {format(new Date(t.trial_ends_at), "MMM d")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{stripeStatusBadge(t.stripe_subscription_status)}</TableCell>
                            <TableCell className="text-sm font-medium">{mrrDisplay}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{members.length}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(t.created_at), "MMM d, yyyy")}</TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="p-6 space-y-6">
                                {/* Quick Actions */}
                                {canManageBilling && (
                                  <div className="grid gap-4 sm:grid-cols-4">
                                    {/* Extend Trial */}
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Extend Trial</Label>
                                      <Input type="date" value={editingTrial?.id === t.id ? editingTrial.value : t.trial_ends_at?.slice(0, 10) || ""} onChange={(e) => setEditingTrial({ id: t.id, value: e.target.value })} />
                                      {editingTrial?.id === t.id && (
                                        <Button size="sm" onClick={() => { actionMutation.mutate({ action: "extend_trial", tenant_id: t.id, new_trial_end: editingTrial.value }); setEditingTrial(null); }} disabled={actionMutation.isPending}>Save</Button>
                                      )}
                                    </div>
                                    {/* Change Plan */}
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Plan</Label>
                                      <Select value={editingPlan?.id === t.id ? editingPlan.value : t.plan} onValueChange={(val) => { setEditingPlan({ id: t.id, value: val }); actionMutation.mutate({ action: "change_plan", tenant_id: t.id, plan: val }); }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="trial">Trial</SelectItem>
                                          <SelectItem value="lite">Lite</SelectItem>
                                          <SelectItem value="full">Full</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {/* Custom Price */}
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Custom Price (¢)</Label>
                                      <Input type="number" placeholder="e.g. 2999" value={editingPrice?.id === t.id ? editingPrice.value : (t.custom_price_cents ?? "")} onChange={(e) => setEditingPrice({ id: t.id, value: e.target.value })} />
                                      {editingPrice?.id === t.id && (
                                        <Button size="sm" onClick={() => { actionMutation.mutate({ action: "set_custom_price", tenant_id: t.id, custom_price_cents: editingPrice.value ? parseInt(editingPrice.value) : null }); setEditingPrice(null); }} disabled={actionMutation.isPending}>Save</Button>
                                      )}
                                    </div>
                                    {/* Resync Stripe */}
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Stripe Sync</Label>
                                      <Button variant="outline" size="sm" onClick={() => actionMutation.mutate({ action: "resync_stripe", tenant_id: t.id })} disabled={actionMutation.isPending}>
                                        <RefreshCw className="mr-1 h-3 w-3" /> Resync Now
                                      </Button>
                                      {t.last_synced_at && (
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <Clock className="h-3 w-3" /> {format(new Date(t.last_synced_at), "MMM d, HH:mm")}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Notes */}
                                {canManageBilling && (
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium">Admin Notes</Label>
                                    <Textarea value={editingNotes?.id === t.id ? editingNotes.value : (t.notes ?? "")} onChange={(e) => setEditingNotes({ id: t.id, value: e.target.value })} placeholder="Internal notes…" rows={2} />
                                    {editingNotes?.id === t.id && (
                                      <Button size="sm" onClick={() => { actionMutation.mutate({ action: "update_tenant_notes", tenant_id: t.id, notes: editingNotes.value }); setEditingNotes(null); }} disabled={actionMutation.isPending}>Save Notes</Button>
                                    )}
                                  </div>
                                )}

                                {/* View as Tenant */}
                                {(isAdmin || isSupportAgent) && (
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/admin/impersonate/${t.id}`)}
                                      className="text-amber-700 border-amber-300 hover:bg-amber-500/10"
                                    >
                                      <Eye className="mr-1 h-3.5 w-3.5" /> View as Tenant
                                    </Button>
                                  </div>
                                )}

                                {/* Members */}
                                <div>
                                  <Label className="text-xs font-medium mb-2 block">Members ({members.length})</Label>
                                  <div className="space-y-2">
                                    {members.map((m: any) => {
                                      const profile = m.profiles;
                                      return (
                                        <div key={m.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                                          <div>
                                            <div className="text-sm font-medium">{profile?.full_name || "No name"}</div>
                                            <div className="text-xs text-muted-foreground">{profile?.email}</div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{m.role}</Badge>
                                            {canResetPasswords && (
                                              resetUserId === m.user_id ? (
                                                <div className="flex items-center gap-1">
                                                  <Input type="password" placeholder="New password" className="h-8 w-36 text-xs" value={resetPassword} onChange={(e) => setResetPasswordValue(e.target.value)} />
                                                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={resetPassword.length < 6 || actionMutation.isPending} onClick={() => { actionMutation.mutate({ action: "reset_password", target_user_id: m.user_id, new_password: resetPassword }); setResetUserId(null); setResetPasswordValue(""); }}>Set</Button>
                                                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setResetUserId(null); setResetPasswordValue(""); }}>✕</Button>
                                                </div>
                                              ) : (
                                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setResetUserId(m.user_id)}>
                                                  <Key className="mr-1 h-3 w-3" /> Reset PW
                                                </Button>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
                {tenants.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-40" />
                        <p className="font-medium">
                          {isSearching ? "No results found" : "No tenants found"}
                        </p>
                        <p className="text-xs">
                          {isSearching
                            ? `No tenants match "${debouncedSearch}". Try a different search term.`
                            : "No tenant accounts have been created yet."
                          }
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {!isSearching && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
