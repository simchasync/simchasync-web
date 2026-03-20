import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CardListSkeleton } from "@/components/ui/page-skeletons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare, Loader2, Lightbulb } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-muted text-muted-foreground",
};

const FEATURE_STATUS_COLORS: Record<string, string> = {
  under_review: "bg-blue-100 text-blue-800",
  planned: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
};

export default function Support() {
  const { user } = useAuth();
  const { tenantId } = useTenantId();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [form, setForm] = useState({ subject: "", description: "", priority: "medium" });
  const [featureForm, setFeatureForm] = useState({ title: "", description: "" });
  const [replyText, setReplyText] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: featureRequests = [], isLoading: featuresLoading } = useQuery({
    queryKey: ["feature-requests", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: replies } = useQuery({
    queryKey: ["ticket-replies", viewTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", viewTicket!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!viewTicket?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("support_tickets").insert({
        tenant_id: tenantId!,
        user_id: user!.id,
        subject: values.subject,
        description: values.description,
        priority: values.priority as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setForm({ subject: "", description: "", priority: "medium" });
      setDialogOpen(false);
      toast({ title: t.app.support?.ticketCreated ?? "Ticket created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const featureMutation = useMutation({
    mutationFn: async (values: typeof featureForm) => {
      const { error } = await supabase.from("feature_requests" as any).insert({
        tenant_id: tenantId!,
        user_id: user!.id,
        title: values.title,
        description: values.description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      setFeatureForm({ title: "", description: "" });
      setFeatureDialogOpen(false);
      toast({ title: "Feature request submitted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ticket_replies").insert({
        ticket_id: viewTicket!.id,
        user_id: user!.id,
        message: replyText,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", viewTicket?.id] });
      setReplyText("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <CardListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">
        {t.app.support?.title ?? "Support"}
      </h1>

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Support Tickets
          </TabsTrigger>
          <TabsTrigger value="features">
            <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
            Feature Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />{t.app.support?.newTicket ?? "New Ticket"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.app.support?.newTicket ?? "New Support Ticket"}</DialogTitle>
                  <DialogDescription>Describe your issue and we'll get back to you.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder={t.app.support?.subject ?? "Subject"}
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                  <Textarea
                    placeholder={t.app.support?.description ?? "Describe your issue..."}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                  />
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    disabled={!form.subject || createMutation.isPending}
                    onClick={() => createMutation.mutate(form)}
                  >
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t.app.support?.submit ?? "Submit Ticket"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {!tickets?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <p>{t.app.support?.noTickets ?? "No support tickets yet"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket: any) => (
                <Card
                  key={ticket.id}
                  className="cursor-pointer hover:shadow-md transition-all duration-200 animate-card-in card-interactive"
                  onClick={() => setViewTicket(ticket)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={STATUS_COLORS[ticket.status] ?? ""}>
                        {ticket.status?.replace("_", " ")}
                      </Badge>
                      <Badge variant="secondary">{ticket.priority}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
              <DialogTrigger asChild>
                <Button><Lightbulb className="mr-2 h-4 w-4" /> Request a Feature</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request a Feature</DialogTitle>
                  <DialogDescription>Tell us what feature would help your workflow.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Feature title"
                    value={featureForm.title}
                    onChange={(e) => setFeatureForm({ ...featureForm, title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Describe the feature you'd like to see..."
                    value={featureForm.description}
                    onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                    rows={4}
                  />
                  <Button
                    className="w-full"
                    disabled={!featureForm.title || featureMutation.isPending}
                    onClick={() => featureMutation.mutate(featureForm)}
                  >
                    {featureMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {featuresLoading ? (
            <CardListSkeleton count={2} />
          ) : featureRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <p>No feature requests yet. Be the first to suggest one!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {featureRequests.map((fr: any) => (
                <Card key={fr.id} className="animate-card-in">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{fr.title}</p>
                        {fr.description && (
                          <p className="text-sm text-muted-foreground">{fr.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(fr.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={FEATURE_STATUS_COLORS[fr.status] ?? "bg-muted text-muted-foreground"}>
                        {fr.status?.replace("_", " ")}
                      </Badge>
                    </div>
                    {fr.admin_notes && (
                      <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm">
                        <p className="text-xs font-medium text-primary mb-1">Team Response</p>
                        <p className="text-foreground">{fr.admin_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Ticket detail dialog */}
      <Dialog open={!!viewTicket} onOpenChange={(o) => !o && setViewTicket(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTicket?.subject}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline" className={STATUS_COLORS[viewTicket?.status] ?? ""}>
                {viewTicket?.status?.replace("_", " ")}
              </Badge>
              <Badge variant="secondary">{viewTicket?.priority}</Badge>
            </div>
            {viewTicket?.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewTicket.description}</p>
            )}
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Replies</p>
              {replies?.length ? (
                replies.map((r: any) => (
                  <div key={r.id} className={`rounded-lg p-3 text-sm ${r.is_admin ? "bg-primary/10 border border-primary/20" : "bg-muted"}`}>
                    <p className="whitespace-pre-wrap text-foreground">{r.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.is_admin ? "Support Team" : "You"} · {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No replies yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={!replyText || replyMutation.isPending}
                onClick={() => replyMutation.mutate()}
              >
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
