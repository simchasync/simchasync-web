import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GradientBackground } from "@/components/ui/gradient-background";
import { ThemeProvider } from "next-themes";
import { ThemeModeProvider } from "@/contexts/ThemeModeContext";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthRedirect from "./components/AuthRedirect";
import DomainGuard from "./components/DomainGuard";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Maintenance from "./pages/Maintenance";
import { APP_KILL_SWITCH_ENABLED } from "@/lib/appKillSwitch";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PhoneNumber = lazy(() => import("./pages/PhoneNumber"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const AppShell = lazy(() => import("./components/AppShell"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Bookings = lazy(() => import("./pages/app/Bookings"));
const Clients = lazy(() => import("./pages/app/Clients"));
const Invoices = lazy(() => import("./pages/app/Invoices"));
const Team = lazy(() => import("./pages/app/Team"));
const SocialMedia = lazy(() => import("./pages/app/SocialMedia"));
const Support = lazy(() => import("./pages/app/Support"));
const SettingsPage = lazy(() => import("./pages/app/SettingsPage"));
const UpgradePage = lazy(() => import("./pages/app/UpgradePage"));
const LandingPageEditor = lazy(() => import("./pages/app/LandingPageEditor"));
const Agents = lazy(() => import("./pages/app/Agents"));
const Finance = lazy(() => import("./pages/app/Finance"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminShell = lazy(() => import("./pages/admin/AdminShell"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminBilling = lazy(() => import("./pages/admin/AdminBilling"));
const AdminManageAdmins = lazy(() => import("./pages/admin/AdminManageAdmins"));
const AdminRevenue = lazy(() => import("./pages/admin/AdminRevenue"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminImpersonate = lazy(() => import("./pages/admin/AdminImpersonate"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSupportTickets = lazy(() => import("./pages/admin/AdminSupportTickets"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancelled = lazy(() => import("./pages/PaymentCancelled"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast({
        title: "Error loading data",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  }),
});

const App = () => (
  <ErrorBoundary>
    {APP_KILL_SWITCH_ENABLED ? (
      <Maintenance />
    ) : (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="simchasync-theme"
      >
        <ThemeModeProvider>
          <LanguageProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <TooltipProvider>
                  <GradientBackground />
                  <Toaster />
                  <Sonner />
                  <Analytics />
                  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <AuthRedirect />
                    <DomainGuard />
                    <Suspense fallback={<RouteLoader />}>
                      <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth/login" element={<Login />} />
                      <Route path="/auth/register" element={<Register />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/auth/phone" element={<PhoneNumber />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/book/:slug" element={<PublicBooking />} />
                      <Route path="/payment-success" element={<PaymentSuccess />} />
                      <Route path="/payment-cancelled" element={<PaymentCancelled />} />
                      <Route path="/app" element={<AppShell />}>
                        <Route index element={<Dashboard />} />
                        <Route path="bookings" element={<Bookings />} />
                        <Route path="clients" element={<Clients />} />
                        <Route path="invoices" element={<Invoices />} />
                        <Route path="team" element={<Team />} />
                        <Route path="social" element={<SocialMedia />} />
                        <Route path="support" element={<Support />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="upgrade" element={<UpgradePage />} />
                        <Route path="booking-page" element={<LandingPageEditor />} />
                        <Route path="agents" element={<Agents />} />
                        <Route path="finance" element={<Finance />} />
                      </Route>
                      <Route path="/admin" element={<AdminLogin />} />
                      <Route path="/admin" element={<AdminShell />}>
                        <Route path="overview" element={<AdminOverview />} />
                        <Route path="tenants" element={<AdminTenants />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="billing" element={<AdminBilling />} />
                        <Route path="revenue" element={<AdminRevenue />} />
                        <Route path="support-tickets" element={<AdminSupportTickets />} />
                        <Route path="audit-log" element={<AdminAuditLog />} />
                        <Route path="admins" element={<AdminManageAdmins />} />
                        <Route path="impersonate/:tenantId" element={<AdminImpersonate />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </BrowserRouter>
                </TooltipProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeModeProvider>
      </ThemeProvider>
      </QueryClientProvider>
      )}
  </ErrorBoundary>
);

export default App;
