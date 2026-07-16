import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialBanner } from "@/components/TrialBanner";
import {
  LayoutDashboard, Calendar, Users, FileText, UsersRound, Settings,
  LogOut, Menu, X, Share2, HelpCircle, Paintbrush, UserCheck, BarChart3,
  ChevronLeft, ChevronDown, MoreHorizontal, Inbox,
} from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import BrandLogo from "@/components/BrandLogo";
import MuiThemeBridge from "@/theme/MuiThemeBridge";

const allNavItems = [
  { key: "dashboard", path: "/app", icon: LayoutDashboard, roles: ["owner", "social_media_manager", "booking_manager"] },
  { key: "bookings", path: "/app/bookings", icon: Calendar, roles: ["owner", "booking_manager", "member"] },
  { key: "clients", path: "/app/clients", icon: Users, roles: ["owner", "booking_manager"] },
  { key: "invoices", path: "/app/invoices", icon: FileText, roles: ["owner"] },
  { key: "agents", path: "/app/agents", icon: UserCheck, roles: ["owner"] },
  { key: "finance", path: "/app/finance", icon: BarChart3, roles: ["owner"] },
  { key: "inquiries", path: "/app/inquiries", icon: Inbox, roles: ["owner", "booking_manager"] },
  { key: "team", path: "/app/team", icon: UsersRound, roles: ["owner"] },
  { key: "social", path: "/app/social", icon: Share2, roles: ["owner", "social_media_manager"] },
  { key: "support", path: "/app/support", icon: HelpCircle, roles: ["owner", "social_media_manager", "booking_manager"] },
  { key: "bookingPage", path: "/app/booking-page", icon: Paintbrush, roles: ["owner"] },
  { key: "settings", path: "/app/settings", icon: Settings, roles: ["owner"] },
] as const;

const PRIMARY_NAV_KEYS = new Set(["dashboard", "bookings", "clients", "invoices"]);

export default function AppShell() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const { role } = useUserRole();
  const { loading: subLoading, workspaceActive, canAccess } = useSubscription();

  // Finance reports + agent commissions are Pro/Premium features — hidden on the Lite plan
  const canSeeFinance = canAccess("expenses_profit");
  // Customer Inquiries is Premium-only — hidden on Lite and Pro
  const canSeeInquiries = canAccess("customer_inquiries");
  const filteredNavItems = useMemo(
    () => allNavItems.filter(
      (item) =>
        (!role || (item.roles as readonly string[]).includes(role)) &&
        ((item.key !== "finance" && item.key !== "agents") || canSeeFinance) &&
        (item.key !== "inquiries" || canSeeInquiries)
    ),
    [role, canSeeFinance, canSeeInquiries]
  );
  const navItems = useMemo(
    () => workspaceActive ? filteredNavItems : [],
    [workspaceActive, filteredNavItems]
  );
  const userPhone = useMemo(() => {
    const metadata = user?.user_metadata as { phone?: string } | undefined;
    return metadata?.phone?.trim() || "";
  }, [user]);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const primaryNavItems = useMemo(() => navItems.filter(i => PRIMARY_NAV_KEYS.has(i.key)), [navItems]);
  const advancedNavItems = useMemo(() => navItems.filter(i => !PRIMARY_NAV_KEYS.has(i.key)), [navItems]);

  const isActive = useCallback((path: string) => {
    if (path === "/app") return location.pathname === "/app";
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  // Auto-expand Advanced section when user is on an advanced route
  useEffect(() => {
    if (advancedNavItems.some(i => isActive(i.path))) setAdvancedOpen(true);
  }, [location.pathname, advancedNavItems, isActive]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && !userPhone && location.pathname.startsWith("/app")) {
      navigate("/auth/phone", { replace: true });
    }
  }, [loading, user, userPhone, location.pathname, navigate]);

  useEffect(() => {
    if (!role) return;
    if (location.pathname === "/app/upgrade") return;
    const currentAllowed = navItems.some((item) => isActive(item.path));
    if (!currentAllowed && navItems[0]) {
      navigate(navItems[0].path, { replace: true });
    }
  }, [role, location.pathname, navItems, navigate, isActive]);

  useEffect(() => {
    if (subLoading) return;
    if (location.pathname === "/app/upgrade") return;
    if (!workspaceActive) {
      navigate("/app/upgrade");
    }
  }, [workspaceActive, subLoading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <MuiThemeBridge>
    <div className="flex h-screen overflow-hidden">
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
          <BrandLogo showWordmark={!collapsed} size="sm" wordmarkClassName="truncate" />
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
          {(collapsed ? navItems : primaryNavItems).map((item) => {
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

          {/* Advanced section — desktop expanded only */}
          {!collapsed && advancedNavItems.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setAdvancedOpen(v => !v)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest hover:text-sidebar-foreground/60 transition-colors rounded-lg hover:bg-sidebar-accent/50"
              >
                <span>Advanced</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")} />
              </button>
              {advancedOpen && advancedNavItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 relative",
                      active
                        ? "bg-sidebar-primary/15 text-sidebar-primary"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-sidebar-primary")} />
                    <span className="truncate">{t.app.nav[item.key as keyof typeof t.app.nav]}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {!collapsed && <LanguageSwitcher variant="compact" className="w-full justify-start" />}
          {collapsed ? (
            <div className="flex justify-center">
              <ThemeToggle
                variant="icon"
                className="h-9 w-9 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              />
            </div>
          ) : (
            <ThemeToggle variant="default" className="text-sidebar-foreground/60" />
          )}
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
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-gradient-sidebar shadow-2xl animate-slide-in-left">
            <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <BrandLogo size="sm" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-sidebar-foreground hover:bg-sidebar-accent">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="shrink-0 px-3 py-2.5 border-b border-sidebar-border">
              <WorkspaceSwitcher />
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {primaryNavItems.map((item) => {
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
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
                    <item.icon className={cn("h-[18px] w-[18px]", active && "text-sidebar-primary")} />
                    {t.app.nav[item.key as keyof typeof t.app.nav]}
                  </Link>
                );
              })}
              {advancedNavItems.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setAdvancedOpen(v => !v)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest hover:text-sidebar-foreground/60 transition-colors rounded-lg hover:bg-sidebar-accent/50"
                  >
                    <span>Advanced</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")} />
                  </button>
                  {advancedOpen && advancedNavItems.map((item) => {
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
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
                        <item.icon className={cn("h-[18px] w-[18px]", active && "text-sidebar-primary")} />
                        {t.app.nav[item.key as keyof typeof t.app.nav]}
                      </Link>
                    );
                  })}
                </div>
              )}
            </nav>
            <div className="shrink-0 border-t border-sidebar-border p-2 space-y-1">
              <LanguageSwitcher variant="compact" className="w-full justify-start" />
              <ThemeToggle
                variant="default"
                className="text-sidebar-foreground/60"
              />
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
        {/* Top bar: menu + title on mobile; notifications top-right on all sizes */}
        <header
          className={cn(
            "flex h-14 shrink-0 items-center gap-3 border-b bg-card/80 glass px-4",
            "max-md:dark:border-b-white/5 max-md:dark:!bg-[#0b111e] max-md:dark:backdrop-blur-xl"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="hover:bg-muted md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <BrandLogo size="xs" wordmarkClassName="truncate max-w-[120px]" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="md:hidden">
              <ThemeToggle variant="icon" className="hover:bg-muted" />
            </div>
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
            {primaryNavItems.slice(0, 4).map((item) => {
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
            <button
              onClick={() => { setAdvancedOpen(true); setSidebarOpen(true); }}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-all duration-200 active:scale-95"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-xl">
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </div>
              <span>More</span>
            </button>
          </nav>
        )}

        <PWAInstallPrompt />
      </div>
    </div>
    </MuiThemeBridge>
  );
}
