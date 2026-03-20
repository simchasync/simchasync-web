import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

interface Props {
  variant?: "compact" | "full";
}

export default function LanguageSwitcher({ variant = "full" }: Props) {
  const { language, setLanguage } = useLanguage();

  const cycle = () => {
    const langs: Array<"en" | "he" | "yi"> = ["en", "he", "yi"];
    const idx = langs.indexOf(language);
    setLanguage(langs[(idx + 1) % langs.length]);
  };

  const label = language === "en" ? "EN" : language === "he" ? "עב" : "יי";

  return (
    <Button variant="ghost" size={variant === "compact" ? "sm" : "default"} onClick={cycle} className="gap-1">
      <Globe className="h-4 w-4" />
      {label}
    </Button>
  );
}
