import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsDropdown() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteAllReadOpen, setDeleteAllReadOpen] = useState(false);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime: refresh notifications instantly
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ["notifications", user.id] }); }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ["notifications", user.id] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e: Error) => {
      toast({ title: "Could not delete notification", description: e.message, variant: "destructive" });
    },
  });

  const deleteAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").delete().eq("user_id", user!.id).eq("read", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setDeleteAllReadOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Could not delete notifications", description: e.message, variant: "destructive" });
    },
  });

  const unreadCount = notifications?.filter((n: any) => !n.read).length ?? 0;
  const readCount = notifications?.filter((n: any) => n.read).length ?? 0;

  return (
    <>
    <ConfirmDestructiveDialog
      open={deleteAllReadOpen}
      onOpenChange={setDeleteAllReadOpen}
      title="Delete all read notifications?"
      description="This removes every notification you have already marked as read. This cannot be undone."
      confirmLabel="Delete all read"
      pendingLabel="Deleting…"
      onConfirm={() => deleteAllReadMutation.mutate()}
      isPending={deleteAllReadMutation.isPending}
    />
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-sidebar-foreground/60 hover:text-sidebar-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <div className="flex shrink-0 items-center gap-0.5">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <Check className="mr-1 h-3 w-3" /> Mark all read
              </Button>
            )}
            {readCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteAllReadOpen(true)}
                disabled={deleteAllReadMutation.isPending}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Delete all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !notifications?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={cn(
                  "group flex items-center border-b text-sm transition-colors",
                  !n.read && "bg-accent/30"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => {
                    if (!n.read) markReadMutation.mutate(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                >
                  <p className="font-medium text-foreground">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </button>
                <div className="flex shrink-0 self-stretch items-center pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    aria-label="Delete notification"
                    disabled={deleteOneMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteOneMutation.mutate(n.id);
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
    </>
  );
}
