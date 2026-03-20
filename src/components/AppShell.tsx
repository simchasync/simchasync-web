import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, TenantRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialBanner } from "@/components/TrialBanner";
import {
  LayoutDashboard, Calendar, Users, FileText, UsersRound, Settings,
  LogOut, Music, Menu, X, Share2, HelpCircle, Paintbrush, UserCheck, BarChart3,
  ChevronLeft
} from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const allNavItems = [
  { key: "dashboard", path: "/app", icon: LayoutDashboard, roles: ["owner", "social_media_manager", "booking_manager"] },
  { key: "bookings", path: "/app/bookings", icon: Calendar, roles: ["owner", "booking_manager", "member"] },
  { key: "clients", path: "/app/clients", icon: Users, roles: ["owner", "booking_manager"] },
  { key: "invoices", path: "/app/invoices", icon: FileText, roles: ["owner"] },
  { key: "agents", path: "/app/agents", icon: UserCheck, roles: ["owner"] },
  { key: "finance", path: "/app/finance", icon: BarChart3, roles: ["owner"] },
  { key: "team", path: "/app/team", icon: UsersRound, roles: ["owner"] },
  { key: "social", path: "/app/social", icon: Share2, roles: ["owner", "social_media_manager"] },
  { key: "support", path: "/app/support", icon: HelpCircle, roles: ["owner", "social_media_manager", "booking_manager"] },
  { key: "bookingPage", path: "/app/booking-page", icon: Paintbrush, roles: ["owner"] },
  { key: "settings", path: "/app/settings", icon: Settings, roles: ["owner"] },
] as const;

export default function AppShell() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const { role } = useUserRole();
  const { trialExpired, subscribed, loading: subLoading, workspaceActive, plan } = useSubscription();

  const filteredNavItems = allNavItems.filter(
    (item) => !role || (item.roles as readonly string[]).includes(role)
  );
  const navItems = workspaceActive ? filteredNavItems : [];
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!role) return;
    if (location.pathname === "/app/upgrade") return;
    const currentAllowed = navItems.some((item) => isActive(item.path));
    if (!currentAllowed && navItems[0]) {
      navigate(navItems[0].path, { replace: true });
    }
  }, [role, location.pathname, navItems, navigate]);

  useEffect(() => {
    if (subLoading) return;
    if (location.pathname === "/app/upgrade") return;
    if (!workspaceActive) {
      navigate("/app/upgrade");
    }
  }, [workspaceActive, subLoading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const isActive = (path: string) => {
    if (path === "/app") return location.pathname === "/app";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col flex-shrink-0 border-r border-sidebar-border bg-gradient-sidebar h-screen sticky top-0 transition-all duration-300 ease-out",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex h-16 items-center border-b border-sidebar-border transition-all duration-300",
          collapsed ? "justify-center px-2" : "gap-3 px-5"
        )}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shrink-0 shadow-vibrant">
            <Music className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display text-base font-bold text-primary truncate">SimchaSync</span>
          )}
        </div>

        {/* Workspace Switcher */}
        {!collapsed && (
          <div className="px-3 py-2.5 border-b border-sidebar-border">
            <WorkspaceSwitcher />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {navItems.length === 0 && !subLoading && (
            <div className="px-3 py-4 text-xs text-sidebar-foreground/50 text-center">
              Workspace inactive
            </div>
          )}
          {navItems.map((item) => {
            const active = isActive(item.path);
            const linkContent = (
              <Link
                key={item.key}
                to={item.path}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 relative",
                  active
                    ? "bg-sidebar-primary/15 text-sidebar-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
                )}
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-sidebar-primary")} />
                {!collapsed && (
                  <span className="truncate">{t.app.nav[item.key as keyof typeof t.app.nav]}</span>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.key} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {t.app.nav[item.key as keyof typeof t.app.nav]}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return linkContent;
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {!collapsed && <LanguageSwitcher variant="compact" className="w-full justify-start" />}
          <NotificationsDropdown />
          <Button
            variant="ghost"
            onClick={signOut}
            className={cn(
              "w-full gap-3 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "justify-center px-2" : "justify-start"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="text-[13px]">Log Out</span>}
          </Button>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full gap-3 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "justify-center px-2" : "justify-start"
            )}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300 shrink-0", collapsed && "rotate-180")} />
            {!collapsed && <span className="text-[11px]">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/60 glass" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-gradient-sidebar shadow-2xl animate-slide-in-left">
            <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-vibrant shadow-vibrant">
                  <Music className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-display text-base font-bold text-sidebar-foreground">SimchaSync</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-sidebar-foreground hover:bg-sidebar-accent">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="px-3 py-2.5 border-b border-sidebar-border">
              <WorkspaceSwitcher />
            </div>
            <nav className="space-y-0.5 p-2 overflow-y-auto flex-1">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative",
                      active
                        ? "bg-sidebar-primary/15 text-sidebar-primary"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
                    )}
                    <item.icon className={cn("h-[18px] w-[18px]", active && "text-sidebar-primary")} />
                    {t.app.nav[item.key as keyof typeof t.app.nav]}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-sidebar-border p-2 space-y-1">
              <LanguageSwitcher variant="compact" className="w-full justify-start" />
              <Button variant="ghost" onClick={signOut} className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <LogOut className="h-[18px] w-[18px]" /> <span className="text-[13px]">Log Out</span>
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {role !== "social_media_manager" && workspaceActive && <TrialBanner />}
        {/* Top bar (mobile) */}
        <header className="flex h-14 items-center gap-3 border-b bg-card/80 glass px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="hover:bg-muted">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-vibrant shadow-vibrant">
              <Music className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-bold text-foreground">SimchaSync</span>
          </div>
          <div className="ml-auto">
            <NotificationsDropdown />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        {/* Bottom nav (mobile) */}
        {navItems.length > 0 && (
          <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 glass safe-area-bottom md:hidden">
            {navItems.slice(0, 5).map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all duration-200 active:scale-95",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200",
                    active ? "bg-primary/10" : ""
                  )}>
                    <item.icon className="h-[18px] w-[18px]" />
                  </div>
                  <span>{t.app.nav[item.key as keyof typeof t.app.nav]}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <PWAInstallPrompt />
      </div>
    </div>
  );
}
