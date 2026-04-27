import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ThemeToggleProps {
  variant?: "default" | "icon";
  className?: string;
}

export default function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
  const { t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  const label = isDark ? t.app.theme.switchToLight : t.app.theme.switchToDark;

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={variant === "icon" ? "icon" : "sm"}
      className={cn(
        "shrink-0 text-foreground/80 hover:text-foreground",
        variant === "default" && "h-auto w-full justify-start gap-3 px-3 py-2 font-normal",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
    >
      {isDark ? (
        <Moon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      ) : (
        <Sun className="h-[18px] w-[18px] shrink-0" aria-hidden />
      )}
      {variant === "default" && (
        <span className="text-[13px]">{isDark ? t.app.theme.dark : t.app.theme.light}</span>
      )}
      {variant === "icon" && (
        <span className="sr-only">{label}</span>
      )}
    </Button>
  );

  if (!mounted) {
    return (
      <div
        className={cn(
          variant === "default" && "h-9 w-full",
          variant === "icon" && "h-9 w-9",
          className
        )}
        aria-hidden
      />
    );
  }

  if (variant === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
