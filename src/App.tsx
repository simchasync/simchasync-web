import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import PublicBooking from "./pages/PublicBooking";
import AppShell from "./components/AppShell";
import Dashboard from "./pages/app/Dashboard";
import Bookings from "./pages/app/Bookings";
import Clients from "./pages/app/Clients";
import Invoices from "./pages/app/Invoices";
import Team from "./pages/app/Team";
import SocialMedia from "./pages/app/SocialMedia";
import Support from "./pages/app/Support";
import SettingsPage from "./pages/app/SettingsPage";
import UpgradePage from "./pages/app/UpgradePage";
import LandingPageEditor from "./pages/app/LandingPageEditor";
import Agents from "./pages/app/Agents";
import Finance from "./pages/app/Finance";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminShell from "./pages/admin/AdminShell";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminManageAdmins from "./pages/admin/AdminManageAdmins";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminImpersonate from "./pages/admin/AdminImpersonate";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSupportTickets from "./pages/admin/AdminSupportTickets";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancelled from "./pages/PaymentCancelled";
import AuthRedirect from "./components/AuthRedirect";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="simchasync-theme"
      >
        <LanguageProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AuthRedirect />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth/login" element={<Login />} />
                    <Route path="/auth/register" element={<Register />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
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
                </BrowserRouter>
              </TooltipProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
