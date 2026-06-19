import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { useToast } from "@/hooks/use-toast";

export interface CalendarConnection {
  connected: boolean;
  google_email: string | null;
  status: string;
}

export function calendarConnectionKey(tenantId: string | null) {
  return ["calendar-connection", tenantId] as const;
}

/** Fire-and-forget calendar sync for an event change. Never throws. */
export async function syncEventToCalendar(
  tenantId: string,
  action: "upsert" | "delete",
  eventId: string
) {
  try {
    await supabase.functions.invoke("gcal-sync", {
      body: { action, eventId, tenantId },
    });
  } catch {
    // Calendar sync is best-effort and must never block the underlying save.
  }
}

export function useGoogleCalendar() {
  const { tenantId } = useTenantId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: connection, isLoading } = useQuery({
    queryKey: calendarConnectionKey(tenantId),
    queryFn: async (): Promise<CalendarConnection> => {
      const { data, error } = await supabase.rpc("get_my_calendar_connection", {
        _tenant_id: tenantId!,
      });
      if (error) throw error;
      const row = data?.[0];
      return {
        connected: !!row?.connected,
        google_email: row?.google_email ?? null,
        status: row?.status ?? "active",
      };
    },
    enabled: !!tenantId,
  });

  const connect = useCallback(async () => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("gcal-oauth-start", {
      body: { tenantId },
    });
    if (error || !data?.url) {
      toast({ title: "Could not start Google sign-in", variant: "destructive" });
      return;
    }
    window.location.href = data.url;
  }, [tenantId, toast]);

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("gcal-disconnect", {
        body: { tenantId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarConnectionKey(tenantId) });
    },
  });

  const syncNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("gcal-sync", {
        body: { action: "full", tenantId },
      });
      if (error) throw error;
    },
  });

  return {
    connection,
    isConnected: !!connection?.connected,
    needsReauth: connection?.status === "needs_reauth",
    isLoading,
    connect,
    disconnect: disconnect.mutateAsync,
    isDisconnecting: disconnect.isPending,
    syncNow: syncNow.mutateAsync,
    isSyncing: syncNow.isPending,
  };
}
