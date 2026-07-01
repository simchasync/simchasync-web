import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card as MuiCard, CardContent as MuiCardContent, Chip } from "@mui/material";
import { StatCard, SectionHeader } from "@/components/ui/stat-card";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Instagram, Facebook, Pencil, Trash2, Sparkles, CheckCircle2, BarChart3, CalendarDays, FileText, Music } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SocialPost = Tables<"social_posts">;

const PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "twitter"] as const;
const STATUSES  = ["draft", "scheduled", "posted"] as const;
const TONES     = ["warm", "professional", "fun", "elegant"] as const;

const platformIcon: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-3.5 w-3.5" />,
  facebook:  <Facebook  className="h-3.5 w-3.5" />,
  tiktok:    <Music     className="h-3.5 w-3.5" />,
  youtube:   <Music     className="h-3.5 w-3.5" />,
  twitter:   <Music     className="h-3.5 w-3.5" />,
};

const statusColors: Record<string, string> = {
  draft:     "bg-muted/60 text-muted-foreground border-border",
  scheduled: "bg-cyan/10 text-cyan border-cyan/20",
  posted:    "bg-emerald/10 text-emerald border-emerald/20",
};

const emptyForm = {
  platform:       "instagram" as string,
  caption:        "",
  hashtags:       "",
  status:         "draft"    as string,
  scheduled_date: "",
  posted_at:      "",
  event_id:       "",
  notes:          "",
  tone:           "warm"     as string,
};

export default function SocialMedia() {
  const { t } = useLanguage();
  const s = t.app.socialHub;
  const { tenantId } = useTenantId();
  const { canWrite } = useUserRole();
  const qc = useQueryClient();

  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editing,     setEditing]     = useState<SocialPost | null>(null);
  const [form,        setForm]        = useState(emptyForm);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [generating,  setGenerating]  = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["social_posts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*, events(event_type, venue, event_date, clients(name))")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (SocialPost & { events?: any })[];
    },
    enabled: !!tenantId,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, event_type, event_date, clients(name)")
        .eq("tenant_id", tenantId!)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data as { id: string; event_type: string; event_date: string; clients?: { name?: string } | null }[];
    },
    enabled: !!tenantId,
  });

  const { data: tenantName } = useQuery({
    queryKey: ["tenant_name", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("name").eq("id", tenantId!).single();
      return data?.name ?? "";
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      const payload = {
        tenant_id:      tenantId!,
        platform:       values.platform,
        caption:        values.caption  || null,
        hashtags:       values.hashtags || null,
        status:         values.status,
        scheduled_date: values.scheduled_date || null,
        posted_at:      values.status === "posted" && !values.posted_at ? new Date().toISOString() : values.posted_at || null,
        event_id:       values.event_id || null,
        notes:          values.notes    || null,
        updated_at:     new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from("social_posts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("social_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_posts", tenantId] });
      toast({ title: editing ? "Post updated" : "Post created" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_posts", tenantId] });
      toast({ title: "Post deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markPostedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_posts")
        .update({ status: "posted", posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_posts", tenantId] });
      toast({ title: "Marked as posted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (post: SocialPost & { events?: any }) => {
    setEditing(post);
    setForm({
      platform:       post.platform,
      caption:        post.caption        ?? "",
      hashtags:       post.hashtags       ?? "",
      status:         post.status,
      scheduled_date: post.scheduled_date ?? "",
      posted_at:      post.posted_at      ? format(new Date(post.posted_at), "yyyy-MM-dd'T'HH:mm") : "",
      event_id:       post.event_id       ?? "",
      notes:          post.notes          ?? "",
      tone:           "warm",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const generateCaption = async () => {
    const linkedEvent = events.find((e) => e.id === form.event_id);
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-caption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          event_type:  linkedEvent?.event_type ?? "",
          venue:       "",
          client_name: (linkedEvent as any)?.clients?.name ?? "",
          platform:    form.platform,
          tone:        form.tone,
          tenant_name: tenantName ?? "",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setForm((prev) => ({
        ...prev,
        caption:  result.caption  || prev.caption,
        hashtags: result.hashtags || prev.hashtags,
      }));
      toast({ title: "Caption generated" });
    } catch (e: any) {
      toast({ title: "Could not generate caption", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd   = endOfMonth(now);

  const totalCount    = posts.length;
  const draftCount    = posts.filter((p) => p.status === "draft").length;
  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const postedThisMonth = posts.filter((p) => {
    if (!p.posted_at) return false;
    const d = new Date(p.posted_at);
    return d >= thisMonthStart && d <= thisMonthEnd;
  }).length;

  const filtered = posts.filter((p) => {
    const matchPlatform = platformFilter === "all" || p.platform === platformFilter;
    const matchStatus   = statusFilter   === "all" || p.status   === statusFilter;
    return matchPlatform && matchStatus;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight mb-0.5">{s.title}</h1>
          <p className="text-sm text-muted-foreground">{format(now, "EEEE, MMMM d, yyyy")}</p>
        </div>
        {canWrite && (
          <Button onClick={openNew} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
            <Plus className="mr-2 h-4 w-4" /> {s.newPost}
          </Button>
        )}
      </div>

      {/* Stats */}
      {!isLoading && totalCount > 0 && (
        <section>
          <SectionHeader title={t.app.dashboard.overview} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatCard label={s.totalPosts}      value={String(totalCount)}     icon={BarChart3}    accent="violet" />
            <StatCard label={s.drafts}          value={String(draftCount)}     icon={FileText}     accent="amber" />
            <StatCard label={s.scheduledCount}  value={String(scheduledCount)} icon={CalendarDays} accent="cyan" />
            <StatCard label={s.postedThisMonth} value={String(postedThisMonth)} icon={CheckCircle2} accent="emerald" />
          </div>
        </section>
      )}

      {/* Filters */}
      <MuiCard variant="outlined">
        <MuiCardContent className="flex flex-wrap gap-3 p-3 sm:p-4">
          {/* Platform filter */}
          <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1 overflow-x-auto">
            {["all", ...PLATFORMS].map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setPlatformFilter(plat)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  platformFilter === plat
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {plat === "all" ? "All Platforms" : (s.platforms as any)[plat]}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
            {["all", ...STATUSES].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "all" ? "All Statuses" : (s.statuses as any)[st]}
              </button>
            ))}
          </div>
        </MuiCardContent>
      </MuiCard>

      {/* Post list */}
      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <MuiCard variant="outlined">
          <MuiCardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet/10 mb-4">
              <Instagram className="h-8 w-8 text-primary/40" />
            </div>
            <p className="font-medium text-foreground">{s.noPostsYet}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.noPostsHint}</p>
            {canWrite && (
              <Button className="mt-5 gap-1.5" size="sm" onClick={openNew}>
                <Plus className="h-4 w-4" /> {s.newPost}
              </Button>
            )}
          </MuiCardContent>
        </MuiCard>
      ) : (
        <div className="grid gap-3">
          {filtered.map((post: SocialPost & { events?: any }) => {
            const eventLabel = post.events
              ? `${(t.app.bookings.types as any)[post.events.event_type] ?? post.events.event_type} — ${format(new Date(post.events.event_date), "MMM d, yyyy")}`
              : null;
            return (
              <MuiCard key={post.id} variant="outlined" className="overflow-hidden animate-card-in card-interactive">
                <MuiCardContent className="p-0">
                  <div className="flex items-start gap-3 p-4">
                    {/* Platform icon */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                      {platformIcon[post.platform] ?? <Instagram className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {(s.platforms as any)[post.platform] ?? post.platform}
                        </span>
                        <Chip
                          label={(s.statuses as any)[post.status] ?? post.status}
                          variant="outlined"
                          size="small"
                          className={`font-medium ${statusColors[post.status] ?? ""}`}
                          sx={{ height: 20, fontSize: "10px", "& .MuiChip-label": { px: "6px" } }}
                        />
                        {eventLabel && (
                          <span className="text-xs text-muted-foreground">· {eventLabel}</span>
                        )}
                        {post.scheduled_date && post.status === "scheduled" && (
                          <span className="text-xs text-cyan">
                            · {format(new Date(post.scheduled_date), "MMM d")}
                          </span>
                        )}
                        {post.posted_at && post.status === "posted" && (
                          <span className="text-xs text-emerald">
                            · Posted {format(new Date(post.posted_at), "MMM d")}
                          </span>
                        )}
                      </div>

                      {post.caption && (
                        <p className="text-sm text-foreground/90 line-clamp-2 whitespace-pre-wrap">{post.caption}</p>
                      )}
                      {post.hashtags && (
                        <p className="text-xs text-primary/70 line-clamp-1">{post.hashtags}</p>
                      )}
                    </div>
                  </div>

                  {canWrite && (
                    <div className="flex gap-2 border-t border-border/50 px-4 py-2.5">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => openEdit(post)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {post.status !== "posted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 text-emerald border-emerald/30 hover:bg-emerald/5"
                          onClick={() => markPostedMutation.mutate(post.id)}
                          disabled={markPostedMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {s.markPosted}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(post.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </MuiCardContent>
              </MuiCard>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex flex-col w-full sm:max-w-xl max-h-[90vh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>{editing ? t.common.edit : t.common.create} post</DialogTitle>
            <DialogDescription>{editing ? "Update post details" : "Plan a new social media post"}</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Platform + Status row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{s.platform}</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>{(s.platforms as any)[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{s.status}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s2) => (
                        <SelectItem key={s2} value={s2}>{(s.statuses as any)[s2]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linked Event */}
              <div className="space-y-1.5">
                <Label className="text-sm">{s.linkedEvent}</Label>
                <Select value={form.event_id || "__none__"} onValueChange={(v) => setForm({ ...form, event_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={s.noEvent} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__"><span className="text-muted-foreground">{s.noEvent}</span></SelectItem>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {(t.app.bookings.types as any)[ev.event_type] ?? ev.event_type}
                        {" — "}
                        {format(new Date(ev.event_date), "MMM d, yyyy")}
                        {(ev.clients as any)?.name ? ` (${(ev.clients as any).name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tone (for AI generation) */}
              <div className="space-y-1.5">
                <Label className="text-sm">{s.tone}</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((tn) => (
                      <SelectItem key={tn} value={tn}>{(s.tones as any)[tn]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground/80">{s.toneHint}</p>
              </div>

              {/* Caption + AI generate */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{s.caption}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={generateCaption}
                    disabled={generating}
                  >
                    <Sparkles className="h-3 w-3" />
                    {generating ? s.generating : s.generateCaption}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                  placeholder="Write your post caption here…"
                  className="resize-none"
                />
              </div>

              {/* Hashtags */}
              <div className="space-y-1.5">
                <Label className="text-sm">{s.hashtags}</Label>
                <Input
                  value={form.hashtags}
                  onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
                  placeholder="#wedding #dj #simchasync"
                />
                <p className="text-[11px] text-muted-foreground/80">{s.hashtagsHint}</p>
              </div>

              {/* Scheduled date */}
              {form.status === "scheduled" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">{s.scheduledDate}</Label>
                  <Input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-sm">{s.notes}</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="shrink-0 border-t bg-background px-6 py-4">
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-gold text-primary-foreground font-semibold">
                  {saveMutation.isPending ? t.common.loading : t.common.save}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDestructiveDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={s.confirmDeleteTitle}
        description={s.confirmDeleteDesc}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        pendingLabel={t.common.deleting}
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
      />
    </div>
  );
}
