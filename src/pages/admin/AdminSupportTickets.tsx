import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

function adminAction(action: string, body: Record<string, any>) {
  return supabase.functions.invoke("admin-manage-tenant", { body: { action, ...body } });
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-700 border-blue-200",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-200",
  resolved: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-700 border-blue-200",
  high: "bg-orange-500/15 text-orange-700 border-orange-200",
  urgent: "bg-red-500/15 text-red-700 border-red-200",
};

export default function AdminSupportTickets() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", filter, page],
    queryFn: async () => {
      const { data, error } = await adminAction("list_support_tickets", { status: filter, page, page_size: pageSize });
      if (error) throw error;
      return data as { tickets: any[]; total: number };
    },
  });

  const { data: repliesData, isLoading: repliesLoading } = useQuery({
    queryKey: ["admin-ticket-replies", selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await adminAction("get_ticket_replies", { ticket_id: selectedTicket.id });
      if (error) throw error;
      return data as { replies: any[] };
    },
    enabled: !!selectedTicket,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await adminAction("reply_to_ticket", { ticket_id: selectedTicket.id, message: reply });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ticket-replies", selectedTicket.id] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      setReply("");
      toast({ title: "Reply sent" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await adminAction("update_ticket_status", { ticket_id: ticketId, status });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const tickets = data?.tickets || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const replies = repliesData?.replies || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> Support Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total tickets</p>
        </div>
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tickets found</TableCell></TableRow>
                  ) : tickets.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTicket(t)}>
                      <TableCell className="font-medium max-w-[200px] truncate">{t.subject}</TableCell>
                      <TableCell className="text-sm">{t.profiles?.full_name || t.profiles?.email || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.tenants?.name || "—"}</TableCell>
                      <TableCell><Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge></TableCell>
                      <TableCell><Badge className={STATUS_COLORS[t.status] || ""}>{t.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={t.status}
                          onValueChange={(v) => { statusMutation.mutate({ ticketId: t.id, status: v }); }}
                        >
                          <SelectTrigger className="w-28 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Ticket detail + reply dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => { if (!o) { setSelectedTicket(null); setReply(""); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
              {selectedTicket?.profiles?.full_name} • {selectedTicket?.tenants?.name} • {selectedTicket?.priority} priority
            </DialogDescription>
          </DialogHeader>

          {selectedTicket?.description && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">{selectedTicket.description}</div>
          )}

          <ScrollArea className="flex-1 max-h-[400px] border rounded-lg p-3">
            {repliesLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : replies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No replies yet</p>
            ) : (
              <div className="space-y-3">
                {replies.map((r: any) => (
                  <div key={r.id} className={`rounded-lg p-3 text-sm ${r.is_admin ? "bg-primary/10 ml-8" : "bg-muted/50 mr-8"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">
                        {r.profiles?.full_name || "Unknown"} {r.is_admin && <Badge variant="outline" className="ml-1 text-[10px] py-0">Admin</Badge>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "MMM d, h:mm a")}</span>
                    </div>
                    <p>{r.message}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2">
            <Textarea
              placeholder="Type your reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="flex-1 min-h-[60px]"
            />
            <Button
              onClick={() => replyMutation.mutate()}
              disabled={!reply.trim() || replyMutation.isPending}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
