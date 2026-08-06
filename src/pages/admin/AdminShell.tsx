import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Shield, Users, CreditCard, UserCog, LogOut, Loader2, TrendingUp, FileText, UserSearch, MessageSquare, LayoutDashboard, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMIN_BASE, adminPath } from "@/lib/adminRoute";

const navItems = [
  { path: adminPath("overview"), label: "Overview", icon: LayoutDashboard, requiredPermission: "hasAnyAdminRole" as const },
  { path: adminPath("tenants"), label: "Tenants", icon: Users, requiredPermission: "hasAnyAdminRole" as const },
  { path: adminPath("users"), label: "Users", icon: UserSearch, requiredPermission: "hasAnyAdminRole" as const },
  { path: adminPath("billing"), label: "Billing", icon: CreditCard, requiredPermission: "canManageBilling" as const },
  { path: adminPath("revenue"), label: "Revenue", icon: TrendingUp, requiredPermission: "canManageBilling" as const },
  { path: adminPath("support-tickets"), label: "Support", icon: MessageSquare, requiredPermission: "hasAnyAdminRole" as const },
  { path: adminPath("audit-log"), label: "Audit Log", icon: FileText, requiredPermission: "hasAnyAdminRole" as const },
  { path: adminPath("admins"), label: "Manage Admins", icon: UserCog, requiredPermission: "canManageAdmins" as const },
];

export default function AdminShell() {
  const { user, loading: authLoading, signOut } = useAuth();
  const adminRole = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminRole.loading) {
      if (!user) {
        navigate(ADMIN_BASE, { replace: true });
      } else if (!adminRole.hasAnyAdminRole) {
        navigate(ADMIN_BASE, { replace: true });
      }
    }
  }, [authLoading, adminRole.loading, user, adminRole.hasAnyAdminRole, navigate]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (authLoading || adminRole.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !adminRole.hasAnyAdminRole) return null;

  const visibleNav = navItems.filter((item) => adminRole[item.requiredPermission]);

  // Shared sidebar body (rendered in both the desktop rail and the mobile drawer)
  const renderSidebar = (onNavigate?: () => void) => (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Shield className="h-6 w-6 text-sidebar-primary" />
        <span className="font-display text-lg font-bold text-sidebar-primary">Admin</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleNav.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold shadow-sm border border-sidebar-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 truncate text-xs text-sidebar-foreground/50">{user.email}</div>
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
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        {renderSidebar()}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 max-w-[80vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl animate-slide-in-left">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-5 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebar(() => setSidebarOpen(false))}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex md:hidden h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-sidebar-primary" />
            <span className="font-display font-bold text-sidebar-primary">Admin</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
