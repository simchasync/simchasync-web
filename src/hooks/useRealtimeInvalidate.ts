import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RealtimeInvalidateParams {
  /** Unique channel name (include the scoping id, e.g. `events-${tenantId}`). */
  channel: string;
  /** Table to watch in the public schema. */
  table: string;
  /** Postgres row filter, e.g. `tenant_id=eq.${tenantId}`. */
  filter: string;
  /** Query key to invalidate on any change. */
  queryKey: unknown[];
  /** Skip the subscription when false (e.g. id not loaded yet). */
  enabled?: boolean;
}

/**
 * Subscribe to postgres changes on one table and invalidate a query key when
 * rows change. Replaces the duplicated channel/`removeChannel` effect repeated
 * across booking/team/colleague/client lists.
 */
export function useRealtimeInvalidate({
  channel,
  table,
  filter,
  queryKey,
  enabled = true,
}: RealtimeInvalidateParams) {
  const qc = useQueryClient();
  // Keep the latest queryKey without re-subscribing each render.
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => qc.invalidateQueries({ queryKey: queryKeyRef.current })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channel, table, filter, enabled, qc]);
}
