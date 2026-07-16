import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Crown, Plus, MoveRight, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { BOOKING_REQUEST_STATUSES, type BookingRequestStatus } from "@/lib/bookingRequestStatuses";

type Inquiry = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  event_type: string | null;
  event_date: string | null;
  message: string | null;
  status: BookingRequestStatus;
  source: "web" | "manual";
  follow_up_date: string | null;
  created_at: string;
};

const emptyForm = { name: "", email: "", phone: "", event_type: "", event_date: "", message: "" };

export default function Inquiries() {
  const { t } = useLanguage();
  const b = t.app.inquiries;
  const { tenantId } = useTenantId();
  const { canWrite } = useUserRole();
  const { canAccess, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const hasAccess = canAccess("customer_inquiries");

  const { data: inquiries = [] } = useQuery({
    queryKey: ["inquiries", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Inquiry[];
    },
    enabled: !!tenantId && hasAccess,
  });

  useRealtimeInvalidate({
    channel: `inquiries-rt-${tenantId}`,
    table: "booking_requests",
    filter: `tenant_id=eq.${tenantId}`,
    queryKey: ["inquiries", tenantId],
    enabled: !!tenantId && hasAccess,
  });

  const moveTo = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingRequestStatus }) => {
      const { error } = await supabase.from("booking_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inquiries", tenantId] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setFollowUp = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string | null }) => {
      const { error } = await supabase
        .from("booking_requests")
        .update({ follow_up_date: date, follow_up_reminded_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inquiries", tenantId] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addInquiry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("booking_requests").insert({
        tenant_id: tenantId!,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        event_type: form.event_type || null,
        event_date: form.event_date || null,
        message: form.message || null,
        source: "manual",
        status: "new",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inquiries", tenantId] });
      setAddOpen(false);
      setForm(emptyForm);
      toast({ title: b.addInquiry });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!subLoading && !hasAccess) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <Card className="animate-card-in">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Crown className="h-7 w-7 text-primary" />
            </div>
            <p className="font-display text-lg font-semibold">{b.premiumTitle}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{b.premiumHint}</p>
            <Button
              className="mt-5 bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
              onClick={() => navigate("/app/upgrade")}
            >
              <Crown className="mr-2 h-4 w-4" /> {b.upgradeButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const columns = BOOKING_REQUEST_STATUSES.map((status) => ({
    status,
    label: t.app.bookings.requestStatuses[status],
    cards: inquiries.filter((i) => i.status === status),
  }));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">{b.title}</h1>
        {canWrite && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> {b.addInquiry}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.status} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {col.label} <span className="text-xs font-normal">({col.cards.length})</span>
            </h2>
            <div className="space-y-2 min-h-16">
              {col.cards.length === 0 && (
                <p className="text-xs text-muted-foreground/60 py-4 text-center">{b.noInquiries}</p>
              )}
              {col.cards.map((card) => {
                const overdue = !!card.follow_up_date && card.follow_up_date <= today
                  && card.status !== "booked" && card.status !== "declined";
                return (
                  <Card key={card.id} className="animate-row-in">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{card.name}</p>
                        {card.source === "manual" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{b.manualBadge}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {card.event_type ? (t.app.bookings.types as any)[card.event_type] ?? card.event_type : "—"}
                        {card.event_date ? ` · ${format(new Date(card.event_date), "MMM d, yyyy")}` : ""}
                      </p>
                      {card.follow_up_date && (
                        <Badge
                          variant="outline"
                          className={overdue ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted"}
                        >
                          <CalendarClock className="h-3 w-3 mr-1" />
                          {overdue ? b.overdue : format(new Date(card.follow_up_date), "MMM d")}
                        </Badge>
                      )}
                      {canWrite && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                <MoveRight className="mr-1 h-3 w-3" /> {b.moveTo}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {BOOKING_REQUEST_STATUSES.filter((s) => s !== card.status).map((s) => (
                                <DropdownMenuItem key={s} onClick={() => moveTo.mutate({ id: card.id, status: s })}>
                                  {t.app.bookings.requestStatuses[s]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Input
                            type="date"
                            className="h-7 w-32 text-xs"
                            value={card.follow_up_date ?? ""}
                            onChange={(e) => setFollowUp.mutate({ id: card.id, date: e.target.value || null })}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{b.addInquiry}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t.app.clients.name}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t.app.clients.email}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t.app.clients.phone}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>{t.app.bookings.eventType}</Label>
              <Input value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} />
            </div>
            <div>
              <Label>{t.app.bookings.date}</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div>
              <Label>{t.app.bookings.requestMessage}</Label>
              <Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t.common.cancel}</Button>
            <Button
              disabled={!form.name || (!form.email && !form.phone) || addInquiry.isPending}
              onClick={() => addInquiry.mutate()}
            >
              {b.addInquiry}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
