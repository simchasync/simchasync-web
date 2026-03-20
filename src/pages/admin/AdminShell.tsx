import { useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Shield, Users, CreditCard, UserCog, LogOut, Loader2, TrendingUp, FileText, UserSearch, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/admin/tenants", label: "Tenants", icon: Users, requiredPermission: "hasAnyAdminRole" as const },
  { path: "/admin/users", label: "Users", icon: UserSearch, requiredPermission: "hasAnyAdminRole" as const },
  { path: "/admin/billing", label: "Billing", icon: CreditCard, requiredPermission: "canManageBilling" as const },
  { path: "/admin/revenue", label: "Revenue", icon: TrendingUp, requiredPermission: "canManageBilling" as const },
  { path: "/admin/support-tickets", label: "Support", icon: MessageSquare, requiredPermission: "hasAnyAdminRole" as const },
  { path: "/admin/audit-log", label: "Audit Log", icon: FileText, requiredPermission: "hasAnyAdminRole" as const },
  { path: "/admin/admins", label: "Manage Admins", icon: UserCog, requiredPermission: "canManageAdmins" as const },
];

export default function AdminShell() {
  const { user, loading: authLoading, signOut } = useAuth();
  const adminRole = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && !adminRole.loading) {
      if (!user) {
        navigate("/admin", { replace: true });
      } else if (!adminRole.hasAnyAdminRole) {
        navigate("/admin", { replace: true });
      }
    }
  }, [authLoading, adminRole.loading, user, adminRole.hasAnyAdminRole, navigate]);

  if (authLoading || adminRole.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !adminRole.hasAnyAdminRole) return null;

  const visibleNav = navItems.filter((item) => adminRole[item.requiredPermission]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <Shield className="h-6 w-6 text-sidebar-primary" />
          <span className="font-display text-lg font-bold text-sidebar-primary">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            return (
                <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold shadow-sm border border-sidebar-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 text-xs text-sidebar-foreground/50 truncate">{user.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
