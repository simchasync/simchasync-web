import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Inbox, CheckCircle, XCircle, Phone, ArrowRight, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { toHebrewDate } from "@/lib/hebrewDate";
import { getOrCreateClient } from "@/lib/clientDedup";

const REQUEST_STATUSES = ["new", "contacted", "booked", "declined"] as const;

export default function BookingRequests() {
  const { t } = useLanguage();
  const b = t.app.bookings;
  const { tenantId } = useTenantId();
  const qc = useQueryClient();
  const [viewingRequest, setViewingRequest] = useState<any>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["booking-requests", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Realtime sync for booking requests
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`booking-requests-rt-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_requests", filter: `tenant_id=eq.${tenantId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["booking-requests", tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, qc]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("booking_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-requests"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Accept: convert booking request → confirmed event
  const acceptRequest = useMutation({
    mutationFn: async (req: any) => {
      const hebrewDate = req.event_date ? toHebrewDate(req.event_date) : null;

      // 1. Find existing client or create new one (smart dedup)
      let clientId: string | null = null;
      if (req.name && tenantId) {
        const { client } = await getOrCreateClient({
          tenantId,
          name: req.name,
          email: req.email,
          phone: req.phone,
        });
        clientId = client.id;
      }

      // 2. Create the event (use price from external request as total_price)
      const totalPrice = req.price ? Number(req.price) : 0;
      const { error: eventErr } = await supabase.from("events").insert({
        tenant_id: tenantId!,
        client_id: clientId,
        event_date: req.event_date || new Date().toISOString().split("T")[0],
        event_type: req.event_type || "wedding",
        notes: req.message || null,
        hebrew_date: hebrewDate,
        total_price: totalPrice,
      });
      if (eventErr) throw eventErr;

      // 3. Mark request as booked
      const { error: updateErr } = await supabase
        .from("booking_requests")
        .update({ status: "booked" })
        .eq("id", req.id);
      if (updateErr) throw updateErr;

      // 4. Send confirmation email to client (fire & forget)
      if (req.email) {
        supabase.functions.invoke("send-notification-email", {
          body: {
            type: "booking_request_accepted",
            tenant_id: tenantId,
            recipient_email: req.email,
            subject: "Your Booking Request Has Been Confirmed! 🎉",
            body_html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a2e;">Booking Confirmed!</h2>
                <p>Hi <strong>${req.name}</strong>,</p>
                <p>Great news! Your booking request has been accepted and confirmed.</p>
                ${req.event_type ? `<p>Event: <strong>${req.event_type}</strong></p>` : ""}
                ${req.event_date ? `<p>Date: <strong>${format(new Date(req.event_date), "MMM d, yyyy")}</strong></p>` : ""}
                <p>We'll be in touch with more details soon.</p>
                <p style="margin-top: 20px; color: #666;">Thank you for choosing us!</p>
              </div>`,
          },
        }).catch(console.warn);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-requests"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Request accepted! Booking and client created." });
      setViewingRequest(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Decline: update status + send rejection email
  const declineRequest = useMutation({
    mutationFn: async (req: any) => {
      const { error } = await supabase
        .from("booking_requests")
        .update({ status: "declined" })
        .eq("id", req.id);
      if (error) throw error;

      // Send rejection email (fire & forget)
      if (req.email) {
        supabase.functions.invoke("send-notification-email", {
          body: {
            type: "booking_request_declined",
            tenant_id: tenantId,
            recipient_email: req.email,
            subject: "Booking Request Update",
            body_html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a2e;">Booking Request Update</h2>
                <p>Hi <strong>${req.name}</strong>,</p>
                <p>Thank you for your interest. Unfortunately, we're unable to accommodate your booking request at this time.</p>
                ${req.event_type ? `<p>Event: <strong>${req.event_type}</strong></p>` : ""}
                ${req.event_date ? `<p>Date: <strong>${format(new Date(req.event_date), "MMM d, yyyy")}</strong></p>` : ""}
                <p>We appreciate your understanding and encourage you to reach out for future events.</p>
              </div>`,
          },
        }).catch(console.warn);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-requests"] });
      toast({ title: "Request declined" });
      setViewingRequest(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "new": return "bg-blue-500/15 text-blue-700 border-blue-200";
      case "contacted": return "bg-amber-500/15 text-amber-700 border-amber-200";
      case "booked": return "bg-emerald-500/15 text-emerald-700 border-emerald-200";
      case "declined": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const visibleRequests = requests.filter((r: any) => !(r.source_event_id && (r.status === "booked" || r.status === "declined")));
  const pendingCount = visibleRequests.filter((r: any) => r.status === "new" || r.status === "contacted").length;

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (visibleRequests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Inbox className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">{b.noRequests}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.app.clients.name}</TableHead>
                <TableHead>{t.app.clients.email}</TableHead>
                <TableHead>{t.app.clients.phone}</TableHead>
                <TableHead>{b.eventType}</TableHead>
                <TableHead>{b.date}</TableHead>
                <TableHead>{b.status}</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRequests.map((req: any) => {
                const isExternal = !!req.source_event_id;
                return (
                <TableRow key={req.id} className="animate-row-in">
                  <TableCell className="font-medium">
                    {req.name}
                    {isExternal && (
                      <Badge variant="outline" className="ml-2 bg-violet-500/15 text-violet-700 border-violet-200 text-[10px] px-1.5 py-0">
                        <ExternalLink className="h-2.5 w-2.5 mr-0.5" />
                        Incoming Request
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{req.email || "—"}</TableCell>
                  <TableCell className="text-sm">{req.phone || "—"}</TableCell>
                  <TableCell>{req.event_type ? (b.types as any)[req.event_type] ?? req.event_type : "—"}</TableCell>
                  <TableCell className="text-sm">{req.event_date ? format(new Date(req.event_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(req.status)}>
                      {(b.requestStatuses as any)[req.status] ?? req.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(req.message || isExternal) && (
                        <Button variant="ghost" size="sm" onClick={() => setViewingRequest(req)}>
                          <MessageSquare className="mr-1 h-3.5 w-3.5" /> View
                        </Button>
                      )}
                      {!isExternal && req.status === "new" && (
                        <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: req.id, status: "contacted" })}>
                          <Phone className="mr-1 h-3.5 w-3.5" />{b.markContacted}
                        </Button>
                      )}
                      {(req.status === "new" || req.status === "contacted") && (
                        <>
                          <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => acceptRequest.mutate(req)}>
                            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => isExternal ? updateStatus.mutate({ id: req.id, status: "declined" }) : declineRequest.mutate(req)}>
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Decline
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* View Request Dialog */}
      <Dialog open={!!viewingRequest} onOpenChange={(o) => !o && setViewingRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Request</DialogTitle>
            <DialogDescription>From {viewingRequest?.name}</DialogDescription>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-3">
              {viewingRequest.source_event_id && (
                <div className="rounded-lg bg-violet-500/10 border border-violet-200 p-3">
                  <p className="text-sm font-medium text-violet-700 flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    External Booking Request
                  </p>
                  <p className="text-xs text-violet-600 mt-1">
                    This is a booking request from another workspace. Accept to confirm or decline to pass.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Name</p>
                  <p className="font-medium">{viewingRequest.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p>{viewingRequest.email || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p>{viewingRequest.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Event Type</p>
                  <p>{viewingRequest.event_type ? (b.types as any)[viewingRequest.event_type] ?? viewingRequest.event_type : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date</p>
                  <p>{viewingRequest.event_date ? format(new Date(viewingRequest.event_date), "MMM d, yyyy") : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant="outline" className={statusColor(viewingRequest.status)}>
                    {(b.requestStatuses as any)[viewingRequest.status] ?? viewingRequest.status}
                  </Badge>
                </div>
                {viewingRequest.source_event_id && viewingRequest.price && (
                  <div>
                    <p className="text-muted-foreground text-xs">Assigned Price</p>
                    <p className="font-semibold text-lg">${Number(viewingRequest.price).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {viewingRequest.message && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Message</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-line">{viewingRequest.message}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Received {format(new Date(viewingRequest.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}
          {viewingRequest && (viewingRequest.status === "new" || viewingRequest.status === "contacted") && (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="text-destructive" onClick={() => {
                if (viewingRequest.source_event_id) {
                  updateStatus.mutate({ id: viewingRequest.id, status: "declined" });
                  setViewingRequest(null);
                } else {
                  declineRequest.mutate(viewingRequest);
                }
              }}>
                <XCircle className="mr-1.5 h-4 w-4" /> Decline
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                acceptRequest.mutate(viewingRequest);
              }}>
                <CheckCircle className="mr-1.5 h-4 w-4" /> Accept & Create Booking
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export pending count hook for use in tabs
export function useBookingRequestCount(tenantId: string | null) {
  const { data: count = 0 } = useQuery({
    queryKey: ["booking-requests-count", tenantId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("booking_requests")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .in("status", ["new", "contacted"]);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
  return count;
}
