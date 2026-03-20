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
import { Music, CheckCircle, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const EVENT_TYPES = ["wedding", "bar_mitzvah", "bat_mitzvah", "corporate", "concert", "other"] as const;

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const pb = t.publicBooking;

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
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
        <Card className="w-full max-w-md text-center">
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
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
            <p className="text-lg font-medium">{pb.success}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasLandingContent = landingPage?.about || landingPage?.tagline || packages?.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher variant="compact" />
      </div>

      {/* Hero Section */}
      <section
        className="relative flex flex-col items-center justify-center px-4 py-16 md:py-24 text-center overflow-hidden"
        style={landingPage?.hero_image_url ? {
          backgroundImage: `linear-gradient(to bottom, hsl(224 30% 12% / 0.7), hsl(224 30% 12% / 0.85)), url(${landingPage.hero_image_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
      >
        <div className="mx-auto">
          {landingPage?.logo_url && (
            <img src={landingPage.logo_url} alt={tenant.name} className="mx-auto h-20 w-20 rounded-full object-cover border-2 border-primary/30 shadow-lg" />
          )}
          {!landingPage?.logo_url && (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-lg">
              <Music className="h-10 w-10 text-primary" />
            </div>
          )}
          <h1 className="font-display text-3xl md:text-5xl font-bold mb-3 mt-4 text-foreground" style={landingPage?.hero_image_url ? { color: 'white' } : undefined}>
            {tenant.name}
          </h1>
          {landingPage?.tagline && (
            <p className="text-lg md:text-xl text-muted-foreground" style={landingPage?.hero_image_url ? { color: 'rgba(255,255,255,0.8)' } : undefined}>
              {landingPage.tagline}
            </p>
          )}
        </div>
      </section>

      {/* Booking Form Section */}
      <section id="booking-form" className="px-4 py-16 md:py-20 bg-muted/30">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="font-display text-2xl">{pb.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{pb.subtitle}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{pb.name} *</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{pb.email}</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{pb.phone}</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                    <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{pb.message}</Label>
                  <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} />
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground font-semibold">
                  {submitting ? pb.submitting : pb.submit}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {landingPage?.about && (
        <section className="px-4 py-16 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">About</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{landingPage.about}</p>
          </div>
        </section>
      )}

      {/* Services Section */}
      {landingPage?.services_description && (
        <section className="px-4 py-16 md:py-20 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">Our Services</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{landingPage.services_description}</p>
          </div>
        </section>
      )}

      {/* Packages Section */}
      {packages && packages.length > 0 && (
        <section className="px-4 py-16 md:py-20">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10">Packages</h2>
            <div className={`grid gap-6 ${packages.length === 1 ? "max-w-md mx-auto" : packages.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"}`}>
              {packages.map((pkg: any) => (
                <Card key={pkg.id} className={`relative overflow-hidden transition-shadow hover:shadow-lg ${pkg.is_popular ? "ring-2 ring-primary shadow-gold" : ""}`}>
                  {pkg.is_popular && (
                    <div className="absolute top-0 right-0 bg-gradient-gold text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                      POPULAR
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="font-display text-xl">{pkg.name}</CardTitle>
                    {pkg.price && (
                      <p className="text-2xl font-bold text-primary mt-1">{pkg.price}</p>
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
                      onClick={() => {
                        const el = document.getElementById("booking-form");
                        el?.scrollIntoView({ behavior: "smooth" });
                        setShowBookingForm(true);
                      }}
                    >
                      Choose {pkg.name}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        <p>Powered by SimchaSync</p>
      </footer>
    </div>
  );
}
