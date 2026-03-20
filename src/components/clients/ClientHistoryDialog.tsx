import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Eye } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import ViewBookingDialog from "@/components/bookings/ViewBookingDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export default function ClientHistoryDialog({ open, onOpenChange, clientId, clientName }: Props) {
  const { t } = useLanguage();
  const b = t.app.bookings;
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["client_history", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, clients(name)")
        .eq("client_id", clientId)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!clientId,
  });

  const viewingEvent = events.find((e) => e.id === viewingEventId) ?? null;

  const statusColor = (s: string) => {
    switch (s) {
      case "paid": return "bg-emerald-500/15 text-emerald-700 border-emerald-200";
      case "partial": return "bg-amber-500/15 text-amber-700 border-amber-200";
      default: return "bg-destructive/10 text-destructive border-destructive/20";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Client History</DialogTitle>
            <DialogDescription>All bookings for {clientName} — click a row to view details</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Calendar className="mb-2 h-8 w-8 opacity-30" />
              <p>No bookings found for this client</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow
                    key={ev.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setViewingEventId(ev.id)}
                  >
                    <TableCell className="whitespace-nowrap">{format(new Date(ev.event_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{(b.types as any)[ev.event_type] ?? ev.event_type}</TableCell>
                    <TableCell>{ev.venue || ev.location || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(ev.payment_status)}>
                        {(b.paymentStatus as any)[ev.payment_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <ViewBookingDialog
        open={!!viewingEventId}
        onOpenChange={(o) => { if (!o) setViewingEventId(null); }}
        event={viewingEvent}
      />
    </>
  );
}