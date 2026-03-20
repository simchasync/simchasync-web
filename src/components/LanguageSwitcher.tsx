import { useLanguage } from "@/contexts/LanguageContext";
import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "en" as const, label: "English", flag: "🇺🇸" },
  { code: "he" as const, label: "עברית", flag: "🇮🇱" },
  { code: "yi" as const, label: "ייִדיש", flag: "✡️" },
];

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

export default function LanguageSwitcher({ variant = "default", className }: Props) {
  const { language, setLanguage } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={variant === "compact" ? "sm" : "default"}
          className={cn("gap-2 font-medium", className)}
        >
          <Languages className="h-4 w-4" />
          <span className="text-sm">{current.flag} {current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "gap-2 cursor-pointer",
              lang.code === language && "bg-accent font-medium"
            )}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}