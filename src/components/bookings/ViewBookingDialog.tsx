import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import NavigateButton from "./NavigateButton";
import PaymentsSection from "./PaymentsSection";
import SongsSection from "./SongsSection";
import AttachmentsSection from "./AttachmentsSection";
import ColleaguesSection from "./ColleaguesSection";
import ExpensesProfitSection from "./ExpensesProfitSection";
import { Clock, History, UserCheck, DollarSign, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import ClientHistoryDialog from "@/components/clients/ClientHistoryDialog";
import { getEventPaymentStatus } from "@/lib/eventPaymentStatus";

interface ViewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any | null;
}

export default function ViewBookingDialog({ open, onOpenChange, event }: ViewBookingDialogProps) {
  const { t } = useLanguage();
  const { canAccess } = useSubscription();
  const { role } = useUserRole();
  const b = t.app.bookings;
  const [historyOpen, setHistoryOpen] = useState(false);
  const canViewFinancials = role !== "member";
  const canViewClientHistory = role !== "member";

  // Fetch assigned agents for this booking
  const { data: assignedAgents = [] } = useQuery({
    queryKey: ["booking-agents", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_agents")
        .select("*, agents(name)")
        .eq("event_id", event!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!event?.id && canViewFinancials,
  });

  const { data: linkedInvoices = [] } = useQuery({
    queryKey: ["invoices", "event", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, status, event_id")
        .eq("event_id", event!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!event?.id && canViewFinancials,
  });

  if (!event) return null;

  const displayPaymentStatus = getEventPaymentStatus(event, linkedInvoices);
  const balanceDisplay =
    displayPaymentStatus === "paid"
      ? 0
      : Math.max((Number(event.total_price) || 0) - (Number(event.deposit) || 0), 0);

  const statusColor = (s: string) => {
    switch (s) {
      case "paid": return "bg-emerald-500/15 text-emerald-700 border-emerald-200";
      case "partial": return "bg-amber-500/15 text-amber-700 border-amber-200";
      default: return "bg-destructive/10 text-destructive border-destructive/20";
    }
  };

  const address = event.location || event.venue || "";
  const isWedding = event.event_type === "wedding";

  const timingFields = isWedding
    ? [
        { label: "Chuppah", value: event.chuppah_time },
        { label: "Meal", value: event.meal_time },
        { label: "First Dance", value: event.first_dance_time },
        { label: "Second Dance", value: event.second_dance_time },
        { label: "Mitzvah Tanz", value: event.mitzvah_tanz_time },
      ]
    : [{ label: "Event Start", value: event.event_start_time }];

  const hasTimingData = timingFields.some((f) => f.value);
  const totalCommission = assignedAgents.reduce((s: number, ba: any) => s + (Number(ba.commission_amount) || 0), 0);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{(b.types as any)[event.event_type] ?? event.event_type}</DialogTitle>
          <DialogDescription>Booking details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Core details */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">{b.client}</p>
              <div className="flex items-center gap-1.5">
                <p className="font-medium">{event.clients?.name ?? event.client_name ?? "—"}</p>
                {canViewClientHistory && event.client_id && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setHistoryOpen(true)}>
                    <History className="mr-1 h-3.5 w-3.5" /> History
                  </Button>
                )}
              </div>
            </div>
            <Detail label={b.date} value={format(new Date(event.event_date), "MMM d, yyyy")} />
            <Detail label={b.hebrewDate} value={event.hebrew_date ?? "—"} />
            <Detail label={b.eventType} value={(b.types as any)[event.event_type] ?? event.event_type} />
            <Detail label={b.venue} value={event.venue ?? "—"} />
            <div className="space-y-0.5">
              <p className="text-muted-foreground">{b.location}</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{event.location || "—"}</p>
                {address && <NavigateButton address={address} size="icon" />}
              </div>
            </div>
          </div>

          {/* Event Timing */}
          {hasTimingData && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 font-semibold text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  Event Timing
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                  {timingFields.filter((f) => f.value).map((f) => (
                    <Detail key={f.label} label={f.label} value={f.value} />
                  ))}
                </div>
              </div>
            </>
          )}

          {canViewFinancials && (
            <>
              <Separator />

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Detail label={b.totalPrice} value={`$${event.total_price ?? 0}`} />
                {(event.travel_fee ?? 0) > 0 && <Detail label="Travel Fee" value={`$${event.travel_fee}`} />}
                <Detail label={b.deposit} value={`$${event.deposit ?? 0}`} />
                <Detail label={b.balanceDue} value={`$${balanceDisplay.toLocaleString()}`} />
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">{b.status}</p>
                  <Badge variant="outline" className={statusColor(displayPaymentStatus)}>
                    {(b.paymentStatus as any)[displayPaymentStatus]}
                  </Badge>
                </div>
                {event.due_date && <Detail label={b.dueDate} value={format(new Date(event.due_date), "MMM d, yyyy")} />}
              </div>
            </>
          )}

          {/* Assigned Agents */}
          {canViewFinancials && assignedAgents.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 font-semibold text-sm">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Referral Agents
                  </h4>
                  {totalCommission > 0 && (
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-200">
                      <DollarSign className="h-3 w-3 mr-0.5" />${totalCommission.toLocaleString()}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  {assignedAgents.map((ba: any) => (
                    <div key={ba.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium">{ba.agents?.name || "Agent"}</p>
                          {ba.commission_paid ? (
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
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {event.notes && (
            <>
              <Separator />
              <div className="text-sm space-y-0.5">
                <p className="text-muted-foreground">{b.notes}</p>
                <p className="whitespace-pre-wrap">{event.notes}</p>
              </div>
            </>
          )}

          <Separator />
          <ColleaguesSection eventId={event.id} canWrite={false} tenantId={event.tenant_id} />
          {canViewFinancials && (
            <>
              <Separator />
              <PaymentsSection eventId={event.id} canWrite={false} />
            </>
          )}
          <Separator />
          <SongsSection eventId={event.id} canWrite={false} />
          <Separator />
          <AttachmentsSection eventId={event.id} canWrite={false} />

          {canViewFinancials && canAccess("expenses_profit") && (
            <>
              <Separator />
              <ExpensesProfitSection eventId={event.id} canWrite={false} totalRevenue={event.total_price ?? 0} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {event.client_id && (
      <ClientHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        clientId={event.client_id}
        clientName={event.clients?.name ?? "Client"}
      />
    )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
