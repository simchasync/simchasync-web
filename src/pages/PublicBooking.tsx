import { useState } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Music, CheckCircle, Check, Star, Sparkles, Loader2, ArrowDown,
  User, Mail, Phone, Calendar, MessageSquare,
  ClipboardList, MessageCircle, PartyPopper,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const EVENT_TYPES = ["wedding", "bar_mitzvah", "bat_mitzvah", "corporate", "concert", "other"] as const;

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const pb = t.publicBooking;

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", event_type: "wedding", event_date: "", message: "",
  });

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tenant_by_slug", { _slug: slug! });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as { id: string; name: string; slug: string };
    },
    enabled: !!slug,
  });

  const { data: landingPage } = useQuery({
    queryKey: ["public-landing", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_landing_pages" as any)
        .select("*")
        .eq("tenant_id", tenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!tenant?.id,
  });

  const { data: packages } = useQuery({
    queryKey: ["public-packages", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_packages" as any)
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenant?.id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("booking_requests").insert({
        tenant_id: tenant.id,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        event_type: form.event_type,
        event_date: form.event_date || null,
        message: form.message || null,
      });
      if (error) throw error;

      // Send confirmation email to client (fire & forget)
      if (form.email) {
        supabase.functions.invoke("send-notification-email", {
          body: {
            type: "booking_request_received",
            tenant_id: tenant.id,
            recipient_email: form.email,
            subject: "Booking Request Received ✓",
            body_html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a2e;">Request Received!</h2>
                <p>Hi <strong>${form.name}</strong>,</p>
                <p>Thank you for your booking request with <strong>${tenant.name}</strong>. We've received your request and it is currently under review.</p>
                ${form.event_type ? `<p>Event: <strong>${form.event_type}</strong></p>` : ""}
                ${form.event_date ? `<p>Date: <strong>${form.event_date}</strong></p>` : ""}
                <p>We'll get back to you shortly with a confirmation.</p>
                <p style="margin-top: 20px; color: #666;">Thank you for choosing ${tenant.name}!</p>
              </div>`,
          },
        }).catch(console.warn);
      }

      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant || error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-card">
          <CardContent className="py-12">
            <Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">{pb.notFound}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-card animate-fade-in">
          <CardContent className="py-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-9 w-9 text-emerald-500" />
            </div>
            <p className="text-lg font-medium">{pb.success}</p>
            <p className="mt-2 text-sm text-muted-foreground">{pb.successHint}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    { icon: ClipboardList, title: pb.step1Title, desc: pb.step1Desc },
    { icon: MessageCircle, title: pb.step2Title, desc: pb.step2Desc },
    { icon: PartyPopper, title: pb.step3Title, desc: pb.step3Desc },
  ];

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {landingPage?.logo_url ? (
              <img src={landingPage.logo_url} alt={tenant.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Music className="h-4 w-4 text-primary" />
              </div>
            )}
            <span className="truncate font-display font-semibold">{tenant.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher variant="compact" />
            <Button size="sm" onClick={() => scrollToId("booking-form")} className="hidden bg-gradient-gold text-primary-foreground font-semibold shadow-gold sm:inline-flex">
              {pb.bookNow}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-16 text-center md:py-28"
        style={landingPage?.hero_image_url ? {
          backgroundImage: `linear-gradient(to bottom, hsl(224 30% 12% / 0.7), hsl(224 30% 12% / 0.85)), url(${landingPage.hero_image_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
      >
        <div className="mx-auto max-w-2xl animate-fade-in">
          {landingPage?.logo_url ? (
            <img src={landingPage.logo_url} alt={tenant.name} className="mx-auto h-20 w-20 rounded-full object-cover border-2 border-primary/30 shadow-lg" />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-lg">
              <Music className="h-10 w-10 text-primary" />
            </div>
          )}
          <h1
            className={`font-display text-4xl md:text-6xl font-bold mb-3 mt-5 ${landingPage?.hero_image_url ? "text-white" : "text-gradient-gold"}`}
          >
            {tenant.name}
          </h1>
          {landingPage?.tagline && (
            <p className="text-lg md:text-xl" style={{ color: landingPage?.hero_image_url ? "rgba(255,255,255,0.85)" : "hsl(var(--muted-foreground))" }}>
              {landingPage.tagline}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => scrollToId("booking-form")}
              className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
            >
              {pb.bookNow} <ArrowDown className="ml-2 h-4 w-4" />
            </Button>
            {!!packages?.length && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToId("packages")}
                className={landingPage?.hero_image_url ? "border-white/40 bg-white/5 text-white hover:bg-white/10 hover:text-white" : ""}
              >
                {pb.viewPackages}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* About Section */}
      {landingPage?.about && (
        <section className="px-4 py-16 md:py-20 animate-fade-in">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">{pb.about}</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{landingPage.about}</p>
          </div>
        </section>
      )}

      {/* Services Section */}
      {landingPage?.services_description && (
        <section className="px-4 py-16 md:py-20 bg-muted/30 animate-fade-in">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <PartyPopper className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">{pb.services}</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{landingPage.services_description}</p>
          </div>
        </section>
      )}

      {/* Packages Section */}
      {packages && packages.length > 0 && (
        <section id="packages" className="px-4 py-16 md:py-20 animate-fade-in">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10">{pb.packages}</h2>
            <div className={`grid gap-6 ${packages.length === 1 ? "max-w-md mx-auto" : packages.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"}`}>
              {packages.map((pkg: any) => (
                <Card
                  key={pkg.id}
                  className={`relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-card-hover ${pkg.is_popular ? "ring-2 ring-primary shadow-gold" : "shadow-card"}`}
                >
                  {pkg.is_popular && (
                    <div className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-lg bg-gradient-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                      <Star className="h-3 w-3 fill-current" /> {pb.popular}
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="font-display text-xl">{pkg.name}</CardTitle>
                    {pkg.price && (
                      <p className="text-2xl font-bold text-gradient-gold mt-1">{pkg.price}</p>
                    )}
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {pkg.features?.length > 0 && (
                      <ul className="space-y-2">
                        {pkg.features.filter((f: string) => f.trim()).map((feat: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      className="w-full mt-4 bg-gradient-gold text-primary-foreground font-semibold"
                      onClick={() => scrollToId("booking-form")}
                    >
                      {pb.choosePackage.replace("{name}", pkg.name)}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Booking Form Section */}
      <section id="booking-form" className="px-4 py-16 md:py-20 bg-muted/30">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          {/* How it works */}
          <div className="lg:sticky lg:top-24">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">{pb.title}</h2>
            <p className="text-muted-foreground mb-8">{pb.subtitle}</p>
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pb.howItWorks}</p>
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{pb.name} *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="pl-9" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{pb.email}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{pb.phone}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="pl-9" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{pb.eventType}</Label>
                    <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((et) => (
                          <SelectItem key={et} value={et}>{(t.app.bookings.types as any)[et]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{pb.eventDate}</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="pl-9" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{pb.message}</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} className="pl-9" />
                  </div>
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitting ? pb.submitting : pb.submit}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        <p>{pb.poweredBy}</p>
      </footer>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur-md safe-area-bottom md:hidden">
        <Button onClick={() => scrollToId("booking-form")} className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
          {pb.bookNow}
        </Button>
      </div>
    </div>
  );
}
