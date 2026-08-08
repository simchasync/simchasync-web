import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, MoveRight, CalendarClock } from "lucide-react";
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

export default function Inquiries({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useLanguage();
  const b = t.app.inquiries;
  const { tenantId } = useTenantId();
  const { canWrite } = useUserRole();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
    enabled: !!tenantId,
  });

  useRealtimeInvalidate({
    channel: `inquiries-rt-${tenantId}`,
    table: "booking_requests",
    filter: `tenant_id=eq.${tenantId}`,
    queryKey: ["inquiries", tenantId],
    enabled: !!tenantId,
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

  const today = format(new Date(), "yyyy-MM-dd");
  const columns = BOOKING_REQUEST_STATUSES.map((status) => ({
    status,
    label: t.app.bookings.requestStatuses[status],
    cards: inquiries.filter((i) => i.status === status),
  }));

  return (
    <div className={embedded ? "space-y-4" : "p-4 md:p-6 space-y-4 max-w-7xl mx-auto"}>
      <div className="flex items-center justify-between">
        {!embedded && <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight">{b.title}</h1>}
        {canWrite && (
          <Button onClick={() => setAddOpen(true)} className={embedded ? "ml-auto" : ""}>
            <Plus className="mr-1.5 h-4 w-4" /> {b.addInquiry}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.status} className="flex flex-col rounded-xl border border-border/60 bg-card/60 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {col.label}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {col.cards.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {col.cards.length === 0 && (
                <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border/60">
                  <p className="text-xs text-muted-foreground/60">{b.noInquiries}</p>
                </div>
              )}
              {col.cards.map((card) => {
                const overdue = !!card.follow_up_date && card.follow_up_date <= today
                  && card.status !== "booked" && card.status !== "declined";
                return (
                  <Card key={card.id} className="animate-row-in shadow-sm">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">{card.name}</p>
                        {card.source === "manual" && (
                          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">{b.manualBadge}</Badge>
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
                        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-full justify-center text-xs">
                                <MoveRight className="mr-1.5 h-3.5 w-3.5" /> {b.moveTo}
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
                          <div className="space-y-1">
                            <Label className="text-[11px] font-normal text-muted-foreground">{b.setFollowUp}</Label>
                            <Input
                              type="date"
                              className="h-8 w-full text-xs"
                              value={card.follow_up_date ?? ""}
                              onChange={(e) => setFollowUp.mutate({ id: card.id, date: e.target.value || null })}
                            />
                          </div>
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
