import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/hooks/useTenantId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Paintbrush, Plus, Trash2, GripVertical, Star, ExternalLink, Image, Loader2, Copy, Check } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Link } from "react-router-dom";

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

export default function LandingPageEditor() {
  const { t } = useLanguage();
  const { user } = useAuth();
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

  const publishedOrigin = "https://simcha-harmony-hub.lovable.app";
  const bookingUrl = tenant ? `${publishedOrigin}/book/${tenant.slug}` : "";
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
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl flex items-center gap-2">
            <Paintbrush className="h-7 w-7 text-primary" />
            Booking Page Editor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Customize your public booking landing page</p>
        </div>
        {tenant && (
          <Button variant="outline" size="sm" asChild>
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview
            </a>
          </Button>
        )}
      </div>

      {/* Public Booking Link */}
      {tenant && bookingUrl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Your Public Booking Link</CardTitle>
            <CardDescription className="text-xs">Share this link for marketing — anyone can view and book without logging in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <code className="flex-1 text-xs truncate text-muted-foreground">{bookingUrl}</code>
              <Button variant="ghost" size="icon" onClick={copyBookingUrl}>
                {linkCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Branding & Images</CardTitle>
          <CardDescription>Upload your logo and hero image</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover border" />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
                    {uploadingLogo ? "Uploading..." : "Upload Logo"}
                  </span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "logo")} />
              </label>
            </div>
            <div className="space-y-2">
              <Label>Hero Image</Label>
              {heroImageUrl && (
                <img src={heroImageUrl} alt="Hero" className="h-16 w-32 rounded-lg object-cover border" />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    {uploadingHero ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
                    {uploadingHero ? "Uploading..." : "Upload Hero Image"}
                  </span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "hero")} />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Page Content</CardTitle>
          <CardDescription>Edit your tagline, about section, and services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Making Your Simcha Unforgettable" />
          </div>
          <div>
            <Label>About / Introduction</Label>
            <Textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Tell visitors about yourself and your music..." rows={4} />
          </div>
          <div>
            <Label>Services Description</Label>
            <Textarea value={servicesDescription} onChange={(e) => setServicesDescription(e.target.value)} placeholder="Describe the services you offer..." rows={3} />
          </div>
          <Button onClick={() => saveLandingMutation.mutate()} disabled={saveLandingMutation.isPending} className="bg-gradient-gold text-primary-foreground">
            {saveLandingMutation.isPending ? "Saving..." : "Save Page Content"}
          </Button>
        </CardContent>
      </Card>

      {/* Packages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Packages / Plans</CardTitle>
          <CardDescription>Create tiered packages that visitors can choose from</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {packages.map((pkg, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Package {i + 1}</Badge>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Star className={`h-3.5 w-3.5 ${pkg.is_popular ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                    <Label className="text-xs">Popular</Label>
                    <Switch checked={pkg.is_popular} onCheckedChange={(v) => updatePackage(i, "is_popular", v)} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePackage(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Package Name</Label>
                  <Input value={pkg.name} onChange={(e) => updatePackage(i, "name", e.target.value)} placeholder="e.g. Gold Package" />
                </div>
                <div>
                  <Label className="text-xs">Price</Label>
                  <Input value={pkg.price} onChange={(e) => updatePackage(i, "price", e.target.value)} placeholder="e.g. $2,500" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={pkg.description} onChange={(e) => updatePackage(i, "description", e.target.value)} placeholder="Brief description..." rows={2} />
              </div>
              <div>
                <Label className="text-xs">Features</Label>
                <div className="space-y-1.5 mt-1">
                  {pkg.features.map((feat, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <Input value={feat} onChange={(e) => updateFeature(i, fi, e.target.value)} placeholder="Feature..." className="text-sm" />
                      {pkg.features.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFeature(i, fi)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addFeature(i)} className="text-xs">
                    <Plus className="mr-1 h-3 w-3" /> Add Feature
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addPackage} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add Package
          </Button>

          <Button onClick={() => savePackagesMutation.mutate()} disabled={savePackagesMutation.isPending} className="bg-gradient-gold text-primary-foreground">
            {savePackagesMutation.isPending ? "Saving..." : "Save Packages"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
