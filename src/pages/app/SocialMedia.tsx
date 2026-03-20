import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Instagram, Facebook } from "lucide-react";

export default function SocialMedia() {
  const { t } = useLanguage();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{t.app.nav.social}</h1>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex gap-3 mb-4">
            <Share2 className="h-10 w-10 text-muted-foreground/30" />
            <Instagram className="h-10 w-10 text-muted-foreground/30" />
            <Facebook className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2">Social Media Hub</h2>
          <p className="text-muted-foreground max-w-md">
            Schedule posts, track engagement, and manage your social media presence across platforms.
            This feature is coming soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
