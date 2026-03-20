import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useAdminRole() {
  const { user } = useAuth();

  const { data: roles, isLoading: loading } = useQuery({
    queryKey: ["admin-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r) => r.role);
    },
    enabled: !!user,
  });

  const isAdmin = roles?.includes("admin") ?? false;
  const isBillingAdmin = roles?.includes("billing_admin") ?? false;
  const isSupportAgent = roles?.includes("support_agent") ?? false;
  const hasAnyAdminRole = isAdmin || isBillingAdmin || isSupportAgent;
  const canManageBilling = isAdmin || isBillingAdmin;
  const canResetPasswords = isAdmin || isSupportAgent;
  const canInviteTenants = isAdmin;
  const canManageAdmins = isAdmin;

  return {
    roles: roles || [],
    isAdmin,
    isBillingAdmin,
    isSupportAgent,
    hasAnyAdminRole,
    canManageBilling,
    canResetPasswords,
    canInviteTenants,
    canManageAdmins,
    loading,
  };
}
