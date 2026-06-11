import { useState, useEffect } from "react";
import { useTenantId } from "@/hooks/useTenantId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card as MuiCard, CardContent as MuiCardContent, Chip, IconButton } from "@mui/material";
import { SectionHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Paintbrush, Plus, Trash2, Star, ExternalLink, Image, Loader2, Copy, Check, Sparkles } from "lucide-react";

interface PackageForm {
  id?: string;
  name: string;
  description: string;
  price: string;
  features: string[];
  is_popular: boolean;
  sort_order: number;
}

const emptyPackage: PackageForm = {
  name: "", description: "", price: "", features: [""], is_popular: false, sort_order: 0,
};

function UploadTile({
  label, hint, previewUrl, previewClassName, uploading, onSelect,
}: {
  label: string;
  hint: string;
  previewUrl: string;
  previewClassName: string;
  uploading: boolean;
  onSelect: (file: File) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed bg-muted/20 p-4">
      {previewUrl ? (
        <img src={previewUrl} alt={label} className={`${previewClassName} rounded-xl object-cover border shrink-0`} />
      ) : (
        <div className={`${previewClassName} rounded-xl border bg-muted/40 flex items-center justify-center shrink-0`}>
          <Image className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground/80 mb-2">{hint}</p>
        <label className="inline-flex cursor-pointer">
          <Button variant="outline" size="sm" asChild>
            <span>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
              {uploading ? "Uploading..." : previewUrl ? "Replace" : "Upload"}
            </span>
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onSelect(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  );
}

export default function LandingPageEditor() {
  const { tenantId } = useTenantId();
  const qc = useQueryClient();

  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [servicesDescription, setServicesDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [packages, setPackages] = useState<PackageForm[]>([]);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("name, slug").eq("id", tenantId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: landingPage, isLoading } = useQuery({
    queryKey: ["landing-page", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_landing_pages" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!tenantId,
  });

  const { data: existingPackages } = useQuery({
    queryKey: ["tenant-packages", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_packages" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (landingPage) {
      setTagline(landingPage.tagline || "");
      setAbout(landingPage.about || "");
      setServicesDescription(landingPage.services_description || "");
      setLogoUrl(landingPage.logo_url || "");
      setHeroImageUrl(landingPage.hero_image_url || "");
    }
  }, [landingPage]);

  useEffect(() => {
    if (existingPackages?.length) {
      setPackages(existingPackages.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        price: p.price || "",
        features: p.features?.length ? p.features : [""],
        is_popular: p.is_popular,
        sort_order: p.sort_order,
      })));
    }
  }, [existingPackages]);

  const saveLandingMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        tagline, about,
        services_description: servicesDescription,
        logo_url: logoUrl || null,
        hero_image_url: heroImageUrl || null,
      };
      if (landingPage) {
        const { error } = await supabase
          .from("tenant_landing_pages" as any)
          .update(payload as any)
          .eq("tenant_id", tenantId!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_landing_pages" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Landing page saved! ✓" });
      qc.invalidateQueries({ queryKey: ["landing-page"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const savePackagesMutation = useMutation({
    mutationFn: async () => {
      // Delete removed packages
      const existingIds = existingPackages?.map((p: any) => p.id) || [];
      const currentIds = packages.filter(p => p.id).map(p => p.id!);
      const toDelete = existingIds.filter((id: string) => !currentIds.includes(id));

      for (const id of toDelete) {
        await supabase.from("tenant_packages" as any).delete().eq("id", id);
      }

      // Upsert packages
      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        const cleanFeatures = pkg.features.filter(f => f.trim());
        const payload = {
          tenant_id: tenantId!,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          features: cleanFeatures,
          is_popular: pkg.is_popular,
          sort_order: i,
        };

        if (pkg.id) {
          const { error } = await supabase
            .from("tenant_packages" as any)
            .update(payload as any)
            .eq("id", pkg.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("tenant_packages" as any)
            .insert(payload as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Packages saved! ✓" });
      qc.invalidateQueries({ queryKey: ["tenant-packages"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleImageUpload = async (file: File, type: "logo" | "hero") => {
    if (!tenantId) return;
    const setter = type === "logo" ? setUploadingLogo : setUploadingHero;
    setter(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/${type}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      if (type === "logo") setLogoUrl(publicUrl);
      else setHeroImageUrl(publicUrl);
      toast({ title: `${type === "logo" ? "Logo" : "Hero image"} uploaded!` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  const addPackage = () => {
    setPackages([...packages, { ...emptyPackage, sort_order: packages.length }]);
  };

  const removePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index));
  };

  const updatePackage = (index: number, field: keyof PackageForm, value: any) => {
    setPackages(packages.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const updateFeature = (pkgIndex: number, featIndex: number, value: string) => {
    setPackages(packages.map((p, i) => {
      if (i !== pkgIndex) return p;
      const features = [...p.features];
      features[featIndex] = value;
      return { ...p, features };
    }));
  };

  const addFeature = (pkgIndex: number) => {
    setPackages(packages.map((p, i) => i === pkgIndex ? { ...p, features: [...p.features, ""] } : p));
  };

  const removeFeature = (pkgIndex: number, featIndex: number) => {
    setPackages(packages.map((p, i) => {
      if (i !== pkgIndex) return p;
      return { ...p, features: p.features.filter((_, fi) => fi !== featIndex) };
    }));
  };

  const publicBookingOrigin = (import.meta.env.VITE_PUBLIC_BOOKING_ORIGIN as string | undefined) || window.location.origin;
  const bookingUrl = tenant ? `${publicBookingOrigin}/book/${tenant.slug}` : "";
  const [linkCopied, setLinkCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const copyBookingUrl = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setLinkCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight mb-0.5 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Paintbrush className="h-5 w-5 text-primary" />
            </span>
            Booking Page
          </h1>
          <p className="text-sm text-muted-foreground">Design the public page your clients see — branding, story, and packages.</p>
        </div>
        {tenant && (
          <Button asChild className="w-full sm:w-auto bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview Page
            </a>
          </Button>
        )}
      </div>

      {/* Public Booking Link */}
      {tenant && bookingUrl && (
        <MuiCard variant="outlined" className="animate-card-in overflow-hidden border-t-[3px] border-t-primary/40">
          <MuiCardContent className="p-4 md:p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your public booking link</p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground/80">
              Anyone with this link can view your page and send a booking request — no login needed. Share it anywhere.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center rounded-lg border bg-muted/40 px-3 py-2.5">
                <code className="flex-1 truncate text-xs text-foreground/80">{bookingUrl}</code>
              </div>
              <Button variant="outline" onClick={copyBookingUrl} className="shrink-0">
                {linkCopied
                  ? <><Check className="mr-2 h-4 w-4 text-emerald-600" />Copied!</>
                  : <><Copy className="mr-2 h-4 w-4" />Copy Link</>}
              </Button>
            </div>
          </MuiCardContent>
        </MuiCard>
      )}

      {/* Branding */}
      <section>
        <SectionHeader title="Branding & Images" />
        <MuiCard variant="outlined" className="animate-card-in">
          <MuiCardContent className="p-4 md:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadTile
                label="Logo"
                hint="Square image, shown in the page header"
                previewUrl={logoUrl}
                previewClassName="h-16 w-16"
                uploading={uploadingLogo}
                onSelect={(f) => handleImageUpload(f, "logo")}
              />
              <UploadTile
                label="Hero Image"
                hint="Wide banner photo at the top of your page"
                previewUrl={heroImageUrl}
                previewClassName="h-16 w-28"
                uploading={uploadingHero}
                onSelect={(f) => handleImageUpload(f, "hero")}
              />
            </div>
          </MuiCardContent>
        </MuiCard>
      </section>

      {/* Content */}
      <section>
        <SectionHeader title="Page Content" />
        <MuiCard variant="outlined" className="animate-card-in">
          <MuiCardContent className="space-y-4 p-4 md:p-5">
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                This content also powers the AI chat assistant on your public page — the richer your About and Services, the better its answers.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tagline</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Making Your Simcha Unforgettable" />
              <p className="text-[11px] text-muted-foreground/80">A short phrase shown under your name in the hero section</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">About / Introduction</Label>
              <Textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Tell visitors about yourself and your music..." rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Services Description</Label>
              <Textarea value={servicesDescription} onChange={(e) => setServicesDescription(e.target.value)} placeholder="Describe the services you offer..." rows={3} />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => saveLandingMutation.mutate()}
                disabled={saveLandingMutation.isPending}
                className="w-full sm:w-auto bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
              >
                {saveLandingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saveLandingMutation.isPending ? "Saving..." : "Save Page Content"}
              </Button>
            </div>
          </MuiCardContent>
        </MuiCard>
      </section>

      {/* Packages */}
      <section>
        <SectionHeader title="Packages / Plans" count={packages.length} />
        <div className="space-y-4">
          {packages.length === 0 && (
            <MuiCard variant="outlined" className="animate-card-in">
              <MuiCardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Star className="mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium">No packages yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Add tiered packages so visitors can compare your offers</p>
              </MuiCardContent>
            </MuiCard>
          )}

          {packages.map((pkg, i) => (
            <MuiCard key={pkg.id ?? `new-${i}`} variant="outlined" className="animate-card-in">
              <MuiCardContent className="space-y-3 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Chip
                    label={pkg.name || `Package ${i + 1}`}
                    variant="outlined"
                    size="small"
                    className="font-medium"
                    sx={{ height: 22, fontSize: "11px" }}
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                      <Star className={`h-3.5 w-3.5 ${pkg.is_popular ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      <Label className="text-xs">Popular</Label>
                      <Switch checked={pkg.is_popular} onCheckedChange={(v) => updatePackage(i, "is_popular", v)} />
                    </div>
                    <IconButton
                      size="small"
                      className="text-destructive"
                      sx={{ width: 32, height: 32 }}
                      onClick={() => removePackage(i)}
                      title="Remove package"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Package Name</Label>
                    <Input value={pkg.name} onChange={(e) => updatePackage(i, "name", e.target.value)} placeholder="e.g. Gold Package" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Price</Label>
                    <Input value={pkg.price} onChange={(e) => updatePackage(i, "price", e.target.value)} placeholder="e.g. $2,500" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={pkg.description} onChange={(e) => updatePackage(i, "description", e.target.value)} placeholder="Brief description..." rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Features</Label>
                  <div className="mt-1 space-y-1.5">
                    {pkg.features.map((feat, fi) => (
                      <div key={fi} className="flex items-center gap-2">
                        <Input value={feat} onChange={(e) => updateFeature(i, fi, e.target.value)} placeholder="Feature..." className="text-sm" />
                        {pkg.features.length > 1 && (
                          <IconButton
                            size="small"
                            sx={{ width: 32, height: 32 }}
                            className="shrink-0 text-muted-foreground"
                            onClick={() => removeFeature(i, fi)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => addFeature(i)} className="text-xs">
                      <Plus className="mr-1 h-3 w-3" /> Add Feature
                    </Button>
                  </div>
                </div>
              </MuiCardContent>
            </MuiCard>
          ))}

          <Button variant="outline" onClick={addPackage} className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" /> Add Package
          </Button>

          <div className="flex justify-end">
            <Button
              onClick={() => savePackagesMutation.mutate()}
              disabled={savePackagesMutation.isPending}
              className="w-full sm:w-auto bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
            >
              {savePackagesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {savePackagesMutation.isPending ? "Saving..." : "Save Packages"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
