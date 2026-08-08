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
  ChevronLeft, ChevronDown, MoreHorizontal, Lock,
} from "lucide-react";
import type { PlanFeature } from "@/lib/subscription-tiers";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  { key: "team", path: "/app/team", icon: UsersRound, roles: ["owner"] },
  { key: "social", path: "/app/social", icon: Share2, roles: ["owner", "social_media_manager"] },
  { key: "support", path: "/app/support", icon: HelpCircle, roles: ["owner", "social_media_manager", "booking_manager"] },
  { key: "bookingPage", path: "/app/booking-page", icon: Paintbrush, roles: ["owner"] },
  { key: "settings", path: "/app/settings", icon: Settings, roles: ["owner"] },
] as const;

const PRIMARY_NAV_KEYS = new Set(["dashboard", "bookings", "clients", "invoices"]);

// Nav items that require a paid feature. When the current plan can't access the
// feature the item is shown but LOCKED — clicking it routes to the upgrade page.
// (Dashboard/Bookings/Clients/Invoices + Support/Settings are always available.)
const NAV_FEATURE: Partial<Record<string, PlanFeature>> = {
  agents: "expenses_profit",
  finance: "expenses_profit",
  team: "team_invites",
  bookingPage: "booking_page",
};

export default function AppShell() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const { role } = useUserRole();
  const { loading: subLoading, workspaceActive, canAccess } = useSubscription();

  // Finance reports + agent commissions are Pro/Premium features — hidden on the Lite plan
  // Social Media is parked (kept in drafts) — hidden for everyone for now.
  const canSeeSocial = canAccess("social_media");
  // Show every item the ROLE allows (social stays fully parked). Plan-gated
  // items still appear — they render locked (see isLocked below).
  const filteredNavItems = useMemo(
    () => allNavItems.filter(
      (item) =>
        (!role || (item.roles as readonly string[]).includes(role)) &&
        (item.key !== "social" || canSeeSocial)
    ),
    [role, canSeeSocial]
  );
  // A nav item is locked when its required plan feature isn't on the current plan.
  const isLocked = useCallback((key: string) => {
    const feature = NAV_FEATURE[key];
    return feature ? !canAccess(feature) : false;
  }, [canAccess]);
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
  // Label of the locked feature whose upgrade prompt is showing (null = closed).
  const [lockedPrompt, setLockedPrompt] = useState<string | null>(null);

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

  // If the user opens a plan-locked area directly (e.g. by URL), send them to
  // the upgrade page instead of the gated feature.
  useEffect(() => {
    if (location.pathname === "/app/upgrade") return;
    const current = navItems.find((item) => isActive(item.path));
    if (current && isLocked(current.key)) {
      navigate("/app/upgrade", { replace: true });
    }
  }, [location.pathname, navItems, isActive, isLocked, navigate]);

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

  // Renders a nav entry as a normal Link, or — when the plan doesn't include the
  // feature — as a locked button that opens the upgrade prompt modal.
  const renderNavLink = (
    item: (typeof allNavItems)[number],
    collapsed: boolean,
    onNavigate?: () => void,
  ) => {
    const active = isActive(item.path);
    const locked = isLocked(item.key);
    const label = t.app.nav[item.key as keyof typeof t.app.nav];
    const cls = cn(
      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative",
      collapsed && "justify-center px-2 py-2",
      locked
        ? "text-sidebar-foreground/40 hover:bg-sidebar-accent/50"
        : active
          ? "bg-sidebar-primary/15 text-sidebar-primary"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
    );
    const body = (
      <>
        {active && !locked && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
        )}
        <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && !locked && "text-sidebar-primary")} />
        {!collapsed && <span className="truncate flex-1">{label}</span>}
        {!collapsed && locked && <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />}
      </>
    );
    const el = locked ? (
      <button
        key={item.key}
        type="button"
        onClick={() => { onNavigate?.(); setLockedPrompt(label); }}
        className={cn(cls, "w-full text-left")}
      >
        {body}
      </button>
    ) : (
      <Link key={item.key} to={item.path} onClick={onNavigate} className={cls}>
        {body}
      </Link>
    );
    if (collapsed) {
      return (
        <Tooltip key={item.key} delayDuration={0}>
          <TooltipTrigger asChild>{el}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {locked ? `${label} · Upgrade to unlock` : label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return el;
  };

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
          {(collapsed ? navItems : primaryNavItems).map((item) => renderNavLink(item, collapsed))}

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
              {advancedOpen && advancedNavItems.map((item) => renderNavLink(item, false))}
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
              {primaryNavItems.map((item) => renderNavLink(item, false, () => setSidebarOpen(false)))}
              {advancedNavItems.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setAdvancedOpen(v => !v)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest hover:text-sidebar-foreground/60 transition-colors rounded-lg hover:bg-sidebar-accent/50"
                  >
                    <span>Advanced</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")} />
                  </button>
                  {advancedOpen && advancedNavItems.map((item) => renderNavLink(item, false, () => setSidebarOpen(false)))}
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

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">
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

      {/* Upgrade prompt — shown when a locked (plan-gated) nav item is clicked */}
      <Dialog open={lockedPrompt !== null} onOpenChange={(open) => { if (!open) setLockedPrompt(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{t.app.upgrade.lockedTitle.replace("{feature}", lockedPrompt ?? "")}</DialogTitle>
            <DialogDescription>
              {t.app.upgrade.lockedDescription.replace("{feature}", lockedPrompt ?? "")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setLockedPrompt(null)}>
              {t.app.upgrade.lockedDismiss}
            </Button>
            <Button onClick={() => { setLockedPrompt(null); navigate("/app/upgrade"); }}>
              {t.app.upgrade.lockedViewPlans}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MuiThemeBridge>
  );
}
