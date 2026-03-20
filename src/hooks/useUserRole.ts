import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useSubscription } from "@/contexts/SubscriptionContext";
export type TenantRole = "owner" | "booking_manager" | "social_media_manager" | "member";

export function useUserRole() {
  const { user } = useAuth();
  const { tenantId } = useTenantId();

  const { data: role, isLoading } = useQuery({
    queryKey: ["user-role", user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_tenant_member_role", {
        _tenant_id: tenantId!,
        _user_id: user!.id,
      });
      if (error) throw error;
      return (data as TenantRole | null) ?? null;
    },
    enabled: !!user && !!tenantId,
    staleTime: Infinity,
  });

  const { trialExpired, subscribed, loading: subLoading } = useSubscription();

  const canWrite =
    (role === "owner" || role === "booking_manager") &&
    (subLoading || !trialExpired || subscribed);

  const isOwner = role === "owner";
  const isSocialOnly = role === "social_media_manager";

  return { role, isLoading, canWrite, isOwner, isSocialOnly };
}