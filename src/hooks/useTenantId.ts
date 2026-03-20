import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useCallback, useEffect } from "react";

interface UserTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: string;
}

const STORAGE_KEY = "simchasync_active_tenant";

export function useTenantId() {
  const { user } = useAuth();
  const requestedTenantId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("tenant")
    : null;

  const [activeTenantId, setActiveTenantId] = useState<string | null>(
    () => requestedTenantId || localStorage.getItem(STORAGE_KEY) || null
  );

  const { data: primaryTenantId, isLoading: primaryLoading } = useQuery({
    queryKey: ["tenant-id", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_user_tenant_id", {
        _user_id: user!.id,
      });
      if (error) throw error;
      return data as string | null;
    },
    enabled: !!user,
    refetchInterval: (query) => (query.state.data ? false : 1500),
    retry: 3,
  });

  const { data: userTenants = [] } = useQuery({
    queryKey: ["user-tenants", user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_user_tenants", {
          _user_id: user!.id,
        });
        if (error) return [];
        return (data as UserTenant[]) || [];
      } catch {
        return [];
      }
    },
    enabled: !!user && !!primaryTenantId,
    retry: 1,
    staleTime: 60000,
  });

  useEffect(() => {
    if (!requestedTenantId || userTenants.length === 0) return;
    if (!userTenants.some((tenant) => tenant.tenant_id === requestedTenantId)) return;

    if (activeTenantId !== requestedTenantId) {
      setActiveTenantId(requestedTenantId);
      localStorage.setItem(STORAGE_KEY, requestedTenantId);
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has("tenant")) {
      url.searchParams.delete("tenant");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [requestedTenantId, userTenants, activeTenantId]);

  const tenantId = (() => {
    if (userTenants.length > 0) {
      if (activeTenantId && userTenants.some((t) => t.tenant_id === activeTenantId)) {
        return activeTenantId;
      }
      return userTenants[0]?.tenant_id ?? primaryTenantId;
    }
    return primaryTenantId ?? null;
  })();

  const switchTenant = useCallback((newTenantId: string) => {
    setActiveTenantId(newTenantId);
    localStorage.setItem(STORAGE_KEY, newTenantId);
    window.location.reload();
  }, []);

  useEffect(() => {
    if (tenantId && !activeTenantId) {
      localStorage.setItem(STORAGE_KEY, tenantId);
      setActiveTenantId(tenantId);
    }
  }, [tenantId, activeTenantId]);

  return {
    tenantId,
    isLoading: primaryLoading,
    error: null,
    userTenants,
    switchTenant,
  };
}