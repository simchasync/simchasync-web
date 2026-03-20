import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Music, LayoutDashboard, Calendar, Users, FileText, UsersRound, Share2, Settings, HelpCircle, Crown, Paintbrush, UserCheck, DollarSign, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import TrialBanner from "@/components/TrialBanner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import NotificationsDropdown from "@/components/NotificationsDropdown";

export default function AppShell() {
  const { signOut } = useAuth();
  const { t, dir } = useLanguage();
  const { trialActive, trialDaysLeft, trialExpired, subscribed, workspaceActive } = useSubscription();
  const { tenantId } = useTenantId();
  const { isSocialOnly } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = t.app.nav;

  const links = [
    { path: "/app", label: nav.dashboard, icon: LayoutDashboard, show: !isSocialOnly },
    { path: "/app/bookings", label: nav.bookings, icon: Calendar, show: !isSocialOnly },
    { path: "/app/clients", label: nav.clients, icon: Users, show: !isSocialOnly },
    { path: "/app/invoices", label: nav.invoices, icon: FileText, show: !isSocialOnly },
    { path: "/app/finance", label: "Finance", icon: DollarSign, show: !isSocialOnly },
    { path: "/app/team", label: nav.team, icon: UsersRound, show: true },
    { path: "/app/social", label: nav.social, icon: Share2, show: true },
    { path: "/app/agents", label: "Agents", icon: UserCheck, show: !isSocialOnly },
    { path: "/app/booking-page", label: "Booking Page", icon: Paintbrush, show: !isSocialOnly },
    { path: "/app/support", label: nav.support, icon: HelpCircle, show: true },
    { path: "/app/settings", label: nav.settings, icon: Settings, show: true },
    { path: "/app/upgrade", label: nav.upgrade, icon: Crown, show: true },
  ].filter((l) => l.show);

  const isActive = (path: string) => path === "/app" ? location.pathname === "/app" : location.pathname.startsWith(path);

  if (!workspaceActive && !trialActive) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Music className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Workspace Inactive</h1>
          <p className="text-muted-foreground">Please subscribe to continue.</p>
          <Button onClick={() => navigate("/app/upgrade")}>Choose a Plan</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background" dir={dir}>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Music className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold text-primary">SimchaSync</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 md:relative md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border hidden md:flex">
          <Music className="h-6 w-6 text-sidebar-primary" />
          <span className="font-display text-lg font-bold text-sidebar-primary">SimchaSync</span>
        </div>

        <div className="px-3 pt-4 md:pt-2">
          <WorkspaceSwitcher />
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-200px)]">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive(link.path)
                  ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <LanguageSwitcher variant="compact" />
            <NotificationsDropdown />
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> {t.auth.logout}
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}
