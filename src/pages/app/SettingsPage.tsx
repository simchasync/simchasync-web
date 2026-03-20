import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { User, Building2, Camera, CreditCard, CalendarDays, Copy, ExternalLink, Check, RefreshCw, Link2, FileText, Crown, Info, ChevronDown, Loader2, XCircle, Paintbrush, Trash2, AlertTriangle } from "lucide-react";
import { CancelSubscriptionDialog } from "@/components/billing/CancelSubscriptionDialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useTenantId as useTenantIdHook } from "@/hooks/useTenantId";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";

export default function SettingsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { tenantId, userTenants, switchTenant } = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { plan, tier, trialActive, trialDaysLeft, subscribed, subscriptionEnd, canceling, refreshSubscription, pollUntilSubscribed } = useSubscription();
  const [syncingSubscription, setSyncingSubscription] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const s = t.app.settings;
  const [searchParams, setSearchParams] = useSearchParams();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Workspace state
  const [workspaceName, setWorkspaceName] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");

  // Stripe Connect state
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);
  const [bookingCopied, setBookingCopied] = useState(false);
  const [showCalendarHelp, setShowCalendarHelp] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: tenant, refetch: refetchTenant } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: membership } = useQuery({
    queryKey: ["my-membership", tenantId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!user,
  });

  const isOwner = membership?.role === "owner";

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_workspace", { _tenant_id: tenantId! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Workspace deleted", description: "This workspace has been permanently deleted." });
      setDeleteDialogOpen(false);
      const otherTenant = userTenants?.find((t: any) => t.tenant_id !== tenantId);
      if (otherTenant) {
        switchTenant(otherTenant.tenant_id);
      } else {
        window.location.href = "/app";
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Check Stripe Connect status on return from onboarding
  useEffect(() => {
    if (searchParams.get("stripe_return") === "true" && tenantId) {
      checkStripeStatus();
      setSearchParams({}, { replace: true }); // Clear params to prevent re-trigger
    }
    if (searchParams.get("stripe_refresh") === "true" && tenantId) {
      toast({ title: "Please try connecting Stripe again", description: "The onboarding session expired or needs to be refreshed." });
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get("subscription_success") === "true") {
      setSyncingSubscription(true);
      setSearchParams({}, { replace: true });
      toast({ title: "Updating subscription…", description: "Please wait while we confirm your payment." });
      pollUntilSubscribed(10, 3000).then((confirmed) => {
        setSyncingSubscription(false);
        if (confirmed) {
          toast({ title: "Subscription activated! ✓" });
          queryClient.invalidateQueries({ queryKey: ["tenant"] });
        } else {
          refreshSubscription();
          toast({ title: "Still processing", description: "Your subscription may take a moment to activate. Try refreshing." });
        }
      });
    }
  }, [searchParams, tenantId]);

  const checkStripeStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        body: { tenant_id: tenantId, action: "check_status" },
      });
      if (!error && data?.onboarded) {
        refetchTenant();
        toast({ title: s.stripeConnected + " ✓" });
      }
    } catch {}
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (tenant) {
      setWorkspaceName(tenant.name);
      setPaymentInstructions((tenant as any).payment_instructions || "");
    }
  }, [tenant]);

  const profileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, avatar_url: avatarUrl })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t.common.save + " ✓" });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const workspaceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tenants")
        .update({ name: workspaceName })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t.common.save + " ✓" });
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const paymentInstructionsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tenants")
        .update({ payment_instructions: paymentInstructions } as any)
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t.common.save + " ✓" });
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Avatar updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ tenant_id: tenantId }),
        }
      );
      const data = await resp.json();

      if (!resp.ok) {
        const errMsg = data?.error || "Failed to start onboarding.";
        if (errMsg.includes("signed up for Connect")) {
          toast({
            title: "Stripe Connect Not Enabled",
            description: "Your Stripe account doesn't have Connect enabled yet. Please enable it in your Stripe dashboard at dashboard.stripe.com/connect first.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Stripe Connect Error", description: errMsg, variant: "destructive" });
        }
        setConnectingStripe(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast({ title: "Error", description: "No onboarding URL received. Please try again.", variant: "destructive" });
      setConnectingStripe(false);
    } catch (err: any) {
      toast({ title: "Stripe Connect Error", description: err.message || "Failed to start onboarding.", variant: "destructive" });
      setConnectingStripe(false);
    }
  };

  const handleGenerateCalendarToken = async () => {
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase.from("tenants").update({ calendar_token: token }).eq("id", tenantId!);
      if (error) throw error;
      refetchTenant();
      toast({ title: s.calendarSync + " ✓" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const calendarUrl = tenant?.calendar_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-export?tenant_id=${tenantId}&token=${tenant.calendar_token}`
    : null;

  const copyCalendarUrl = () => {
    if (calendarUrl) {
      navigator.clipboard.writeText(calendarUrl);
      setCalendarCopied(true);
      toast({ title: s.calendarLinkCopied });
      setTimeout(() => setCalendarCopied(false), 2000);
    }
  };

  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{s.title}</h1>

      {/* Profile Section */}
      <Card className="animate-card-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <User className="h-5 w-5 text-primary" />
            {s.profile}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                  {initials(fullName || user?.email || "")}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              {uploading ? t.common.loading : "Click camera to upload"}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t.auth.name}</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>{t.app.clients.phone}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => profileMutation.mutate()}
            disabled={profileMutation.isPending}
            className="bg-gradient-gold text-primary-foreground"
          >
            {profileMutation.isPending ? t.common.loading : t.common.save}
          </Button>
        </CardContent>
      </Card>

      {/* Workspace Section */}
      {isOwner && (
        <Card className="animate-card-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              {s.tenant}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{s.tenant}</Label>
              <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
            </div>
            <Button
              onClick={() => workspaceMutation.mutate()}
              disabled={workspaceMutation.isPending}
              className="bg-gradient-gold text-primary-foreground"
            >
              {workspaceMutation.isPending ? t.common.loading : t.common.save}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Billing / Subscription Section */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Crown className="h-5 w-5 text-primary" />
              Billing & Subscription
            </CardTitle>
            <CardDescription>Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncingSubscription ? (
              <div className="flex items-center gap-3 py-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Updating subscription…</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className={
                    subscribed ? "bg-primary/10 text-primary border-primary/30" :
                    trialActive ? "bg-amber-500/10 text-amber-700 border-amber-200" :
                    "bg-destructive/10 text-destructive border-destructive/30"
                  }>
                    {subscribed
                      ? `${tier === "full" ? "Full Platform" : "Lite"} Plan`
                      : trialActive
                        ? `Trial · ${trialDaysLeft} days left`
                        : "Trial Expired"}
                  </Badge>
                  {canceling && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
                      Cancels at period end
                    </Badge>
                  )}
                  {subscriptionEnd && (
                    <span className="text-xs text-muted-foreground">
                      {canceling ? "Active until" : "Renews"} {new Date(subscriptionEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button asChild className="bg-gradient-gold text-primary-foreground">
                <Link to="/app/upgrade">
                  <Crown className="mr-2 h-4 w-4" />
                  {subscribed ? "Manage Subscription" : trialActive ? "View Plans" : "Choose a Plan"}
                </Link>
              </Button>
              {subscribed && !canceling && (
                <Button variant="ghost" onClick={() => setCancelDialogOpen(true)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Subscription
                </Button>
              )}
            </div>
            <CancelSubscriptionDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} />
          </CardContent>
        </Card>
      )}

      {/* Stripe Connect Section */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              {s.stripeConnect}
            </CardTitle>
            <CardDescription>{s.stripeConnectDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={tenant?.stripe_connect_onboarded ? "bg-emerald-500/15 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}>
                {tenant?.stripe_connect_onboarded ? s.stripeConnected : s.stripeNotConnected}
              </Badge>
            </div>
            {!tenant?.stripe_connect_onboarded ? (
              <div className="flex gap-2">
                <Button onClick={handleConnectStripe} disabled={connectingStripe} className="bg-gradient-gold text-primary-foreground">
                  {connectingStripe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  {connectingStripe ? "Redirecting to Stripe..." : (tenant?.stripe_connect_account_id ? s.stripeOnboarding : s.connectStripe)}
                </Button>
                {tenant?.stripe_connect_account_id && (
                  <Button variant="outline" onClick={checkStripeStatus}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check Status
                  </Button>
                )}
              </div>
            ) : (
              <Button variant="outline" onClick={handleConnectStripe}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {s.stripeManage}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calendar Sync Section */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              {s.calendarSync}
            </CardTitle>
            <CardDescription>{s.calendarSyncDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {calendarUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                  <code className="flex-1 text-xs truncate text-muted-foreground">{calendarUrl}</code>
                  <Button variant="ghost" size="icon" onClick={copyCalendarUrl}>
                    {calendarCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleGenerateCalendarToken}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    {s.regenerateCalendarLink}
                  </Button>
                  <Collapsible open={showCalendarHelp} onOpenChange={setShowCalendarHelp}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Info className="mr-1.5 h-3.5 w-3.5" />
                        Instructions
                        <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${showCalendarHelp ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                </div>
                <Collapsible open={showCalendarHelp} onOpenChange={setShowCalendarHelp}>
                  <CollapsibleContent>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4 text-sm">
                      <p className="text-muted-foreground">Copy the link above, then follow the steps for your calendar app. Events sync one-way from SimchaSync to your calendar.</p>

                      <div className="space-y-1.5">
                        <p className="font-semibold flex items-center gap-1.5">📅 Google Calendar</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground ml-1">
                          <li>Open <span className="font-medium text-foreground">Google Calendar</span> on your computer</li>
                          <li>Click the <span className="font-medium text-foreground">+</span> next to "Other calendars" in the left sidebar</li>
                          <li>Select <span className="font-medium text-foreground">From URL</span></li>
                          <li>Paste the link and click <span className="font-medium text-foreground">Add calendar</span></li>
                        </ol>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold flex items-center gap-1.5">🍎 Apple Calendar (Mac)</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground ml-1">
                          <li>Open <span className="font-medium text-foreground">Calendar</span> app</li>
                          <li>Go to <span className="font-medium text-foreground">File → New Calendar Subscription</span></li>
                          <li>Paste the link and click <span className="font-medium text-foreground">Subscribe</span></li>
                        </ol>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold flex items-center gap-1.5">📱 Apple Calendar (iPhone/iPad)</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground ml-1">
                          <li>Go to <span className="font-medium text-foreground">Settings → Calendar → Accounts</span></li>
                          <li>Tap <span className="font-medium text-foreground">Add Account → Other</span></li>
                          <li>Tap <span className="font-medium text-foreground">Add Subscribed Calendar</span></li>
                          <li>Paste the link and tap <span className="font-medium text-foreground">Next → Save</span></li>
                        </ol>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold flex items-center gap-1.5">📱 Google Calendar (Phone/Tablet)</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground ml-1">
                          <li>Open your mobile browser and go to <span className="font-medium text-foreground">calendar.google.com</span></li>
                          <li>Tap the <span className="font-medium text-foreground">⚙️ Settings</span> gear icon</li>
                          <li>Tap <span className="font-medium text-foreground">Add calendar → From URL</span></li>
                          <li>Paste the link and tap <span className="font-medium text-foreground">Add calendar</span></li>
                          <li>The calendar will sync to your Google Calendar app automatically</li>
                        </ol>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold flex items-center gap-1.5">📧 Outlook</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground ml-1">
                          <li>Open <span className="font-medium text-foreground">Outlook Calendar</span></li>
                          <li>Click <span className="font-medium text-foreground">Add calendar → Subscribe from web</span></li>
                          <li>Paste the link and click <span className="font-medium text-foreground">Import</span></li>
                        </ol>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ) : (
              <Button onClick={handleGenerateCalendarToken} className="bg-gradient-gold text-primary-foreground">
                <CalendarDays className="mr-2 h-4 w-4" />
                {s.generateCalendarLink}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Public Booking Link */}
      {isOwner && tenant && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Link2 className="h-5 w-5 text-primary" />
              {s.publicBooking}
            </CardTitle>
            <CardDescription>{s.publicBookingDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const publishedOrigin = "https://simcha-harmony-hub.lovable.app";
              const bookingUrl = `${publishedOrigin}/book/${tenant.slug}`;
              return (
                <>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                    <code className="flex-1 text-xs truncate text-muted-foreground">{bookingUrl}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(bookingUrl);
                        setBookingCopied(true);
                        toast({ title: s.bookingLinkCopied });
                        setTimeout(() => setBookingCopied(false), 2000);
                      }}
                    >
                      {bookingCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Preview
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/app/booking-page">
                        <Paintbrush className="mr-2 h-4 w-4" />
                        Customize Booking Page
                      </Link>
                    </Button>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Invoice Settings */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Invoice Settings
            </CardTitle>
            <CardDescription>Add payment instructions that will appear on invoices and emails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Payment Instructions</Label>
              <Textarea
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder={"e.g. Pay by check to: John Smith, 123 Main St...\nZelle: john@email.com\nVenmo: @john"}
                rows={5}
              />
            </div>
            <Button
              onClick={() => paymentInstructionsMutation.mutate()}
              disabled={paymentInstructionsMutation.isPending}
              className="bg-gradient-gold text-primary-foreground"
            >
              {paymentInstructionsMutation.isPending ? t.common.loading : t.common.save}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone — Delete Workspace */}
      {isOwner && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Permanently delete this workspace and all its data. This action cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            {tenant?.is_primary_workspace ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>The main workspace cannot be deleted.</span>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Workspace
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Workspace Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Workspace
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all teammates, bookings, clients, invoices, and data from this workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWorkspaceMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWorkspaceMutation.isPending ? "Deleting..." : "Delete Workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
